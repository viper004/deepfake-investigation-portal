from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Replace 'username' and 'password' with your MySQL credentials
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:Apputtan%402004@localhost:3306/dip"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
