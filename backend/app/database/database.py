import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
if os.path.exists(env_file):
    load_dotenv(env_file)
load_dotenv()

import re

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./dip.db"
elif SQLALCHEMY_DATABASE_URL.startswith("mysql://"):
    SQLALCHEMY_DATABASE_URL = "mysql+pymysql://" + SQLALCHEMY_DATABASE_URL[len("mysql://"):]

connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

# Handle Aiven / cloud SSL parameters
if "aivencloud.com" in SQLALCHEMY_DATABASE_URL or "ssl-mode" in SQLALCHEMY_DATABASE_URL:
    # PyMySQL expects ssl in connect_args and rejects ssl-mode in query parameters
    SQLALCHEMY_DATABASE_URL = re.sub(r'[\?&]ssl-mode=[^&]+', '', SQLALCHEMY_DATABASE_URL)
    connect_args["ssl"] = {}

engine_kwargs = {"connect_args": connect_args}
if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "pool_size": 10,
        "max_overflow": 20
    })

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()