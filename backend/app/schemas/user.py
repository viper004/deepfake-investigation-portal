from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    organization: Optional[str] = None
    profile_picture: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    role_id: Optional[int] = None
    status: str
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InvestigatorNoteCreate(BaseModel):
    content: str
    content_json: Optional[dict] = None
    related_evidence_ids: Optional[list[int]] = None


class InvestigatorNoteUpdate(BaseModel):
    content: Optional[str] = None
    content_json: Optional[dict] = None
    related_evidence_ids: Optional[list[int]] = None


class InvestigatorNoteResponse(BaseModel):
    id: int
    case_id: int
    investigator_id: int
    investigator_name: Optional[str] = None
    content: str
    content_json: Optional[dict] = None
    related_evidence_ids: Optional[list[int]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

