"""Definición de pipelines (preproceso + modelo). Lo que se serializa es SIEMPRE el pipeline entero.

Los pipelines trabajan con DataFrames: entrada = columnas de features (num + cat) en el orden
guardado en metadata.json; salida = probabilidad. Así el score de producción es el de validación.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from src import config as C


class CategoryEncoder(BaseEstimator, TransformerMixin):
    """Fija las categorías vistas en entrenamiento. Salida 'category' (LightGBM) o 'str' (CatBoost/LR)."""

    def __init__(self, cat_cols: list[str], output: str = "category"):
        self.cat_cols = cat_cols
        self.output = output

    def fit(self, X: pd.DataFrame, y=None):
        self.categories_ = {c: sorted(X[c].astype(str).unique().tolist()) for c in self.cat_cols}
        self.columns_ = list(X.columns)
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        X = X.copy()
        for c in self.cat_cols:
            s = X[c].astype(str).where(X[c].astype(str).isin(self.categories_[c]), "__other__")
            if self.output == "category":
                X[c] = pd.Categorical(s, categories=self.categories_[c] + ["__other__"])
            else:
                X[c] = s
        return X[self.columns_]

    def get_feature_names_out(self, input_features=None):
        return np.asarray(self.columns_)


def make_pipeline(model: str, num_cols: list[str], cat_cols: list[str], seed: int = C.SEED) -> Pipeline:
    if model == "lr":
        pre = ColumnTransformer([
            ("num", Pipeline([("imp", SimpleImputer(strategy="median", add_indicator=False)),
                              ("sc", StandardScaler())]), num_cols),
            ("cat", OneHotEncoder(handle_unknown="infrequent_if_exist", min_frequency=25, sparse_output=False), cat_cols),
        ], remainder="drop")
        clf = LogisticRegression(C=0.05, class_weight="balanced", max_iter=3000, random_state=seed)
        return Pipeline([("cat", CategoryEncoder(cat_cols, output="str")), ("pre", pre), ("clf", clf)])
    if model == "lgbm":
        from lightgbm import LGBMClassifier
        clf = LGBMClassifier(
            n_estimators=500, learning_rate=0.03, num_leaves=15, max_depth=6, min_child_samples=40,
            subsample=0.8, subsample_freq=1, colsample_bytree=0.6, reg_lambda=5.0, reg_alpha=0.5,
            min_split_gain=0.0, cat_smooth=30, min_data_per_group=60, max_cat_to_onehot=4,
            class_weight="balanced", random_state=seed, n_jobs=4, verbose=-1,
            deterministic=True, force_row_wise=True,       # reproducible bit a bit con la misma semilla
        )
        return Pipeline([("cat", CategoryEncoder(cat_cols, output="category")), ("clf", clf)])
    if model == "catboost":
        from catboost import CatBoostClassifier
        clf = CatBoostClassifier(
            iterations=600, learning_rate=0.04, depth=5, l2_leaf_reg=8, random_strength=1.0,
            auto_class_weights="Balanced", cat_features=cat_cols, random_seed=seed, verbose=0,
            thread_count=4, allow_writing_files=False,
        )
        return Pipeline([("cat", CategoryEncoder(cat_cols, output="str")), ("clf", clf)])
    raise ValueError(model)


class PlattCalibrator:
    """Calibración sigmoide sobre logit(p): p_cal = sigmoid(a·logit(p) + b). Ajustada sobre predicciones out-of-fold."""

    def __init__(self):
        self.a_, self.b_ = 1.0, 0.0

    @staticmethod
    def _logit(p):
        p = np.clip(np.asarray(p, dtype=float), 1e-6, 1 - 1e-6)
        return np.log(p / (1 - p))

    def fit(self, p, y):
        lr = LogisticRegression(C=1e6, max_iter=1000)
        lr.fit(self._logit(p)[:, None], np.asarray(y))
        self.a_, self.b_ = float(lr.coef_[0, 0]), float(lr.intercept_[0])
        return self

    def transform(self, p):
        z = self.a_ * self._logit(p) + self.b_
        return 1 / (1 + np.exp(-z))
