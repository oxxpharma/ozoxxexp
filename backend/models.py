from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime, timezone
import uuid


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


UserRole = Literal["admin", "comercial", "financeiro", "credenciadora", "participante"]


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = ""
    cpf: Optional[str] = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = "participante"
    phone: Optional[str] = ""
    cpf: Optional[str] = ""


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    phone: Optional[str] = None
    cpf: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None


class EventConfig(BaseModel):
    name: str = "Ozoxx Experience"
    start_date: str = "2026-10-08T09:00:00-03:00"
    end_date: str = "2026-10-09T22:00:00-03:00"
    location_name: str = "São Paulo Expo"
    location_address: str = "Rod. dos Imigrantes, km 1,5 - Vila Água Funda, São Paulo - SP"
    location_city: str = "São Paulo"
    description: str = (
        "Uma experiência imersiva de dois dias unindo inovação, networking de alto nível e shows exclusivos no coração de São Paulo."
    )
    short_pitch: str = "08 e 09 de Outubro · São Paulo"
    hero_headline: str = "Ozoxx Experience"
    hero_subheadline: str = "Onde inovação encontra emoção. Dois dias para reescrever o que você sabe sobre experiências."
    cta_primary: str = "Garantir Ingresso"
    cta_secondary: str = "Saber Mais"


class AppearanceConfig(BaseModel):
    logo_url: Optional[str] = ""
    primary_color: str = "#28b9fc"
    secondary_color: str = "#18245a"
    background_color: str = "#070711"
    hero_image_url: str = "https://customer-assets.emergentagent.com/job_5ee424cc-79c0-4969-8e00-992b32e1f84b/artifacts/0rh9068z_fundo.jpg"
    gallery_images: List[str] = Field(default_factory=lambda: [
        "https://images.unsplash.com/photo-1558008258-3256797b43f3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MTN8MHwxfHNlYXJjaHw0fHxjb25mZXJlbmNlJTIwbmV0d29ya2luZyUyMGV2ZW50fGVufDB8fHx8MTc4MDQ5NjMzNXww&ixlib=rb-4.1.0&q=85",
        "https://images.unsplash.com/photo-1657208431551-cbf415b8ef26?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwxfHxjb25jZXJ0JTIwc3RhZ2UlMjBsaWdodHN8ZW58MHx8fHwxNzgwNDk2MzM1fDA&ixlib=rb-4.1.0&q=85",
        "https://images.pexels.com/photos/6420235/pexels-photo-6420235.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    ])
    faq: List[dict] = Field(default_factory=lambda: [
        {"q": "O que é o Ozoxx Experience?", "a": "Um evento imersivo de dois dias em São Paulo unindo inovação, conexões e entretenimento."},
        {"q": "Posso levar acompanhante?", "a": "Sim! No checkout você pode adicionar um(a) acompanhante e cada participante recebe sua própria credencial."},
        {"q": "Como recebo minha credencial?", "a": "Assim que o pagamento for confirmado, você recebe a credencial por e-mail com QR Code e também tem acesso no painel do participante."},
        {"q": "Quais formas de pagamento são aceitas?", "a": "PIX e Cartão de Crédito processados via PagBank com segurança."},
    ])


class TicketTypeCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    price: float
    quantity_available: int = 100
    is_active: bool = True


class TicketTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    quantity_available: Optional[int] = None
    is_active: Optional[bool] = None


class CompanionInfo(BaseModel):
    name: str
    email: EmailStr
    cpf: Optional[str] = ""
    phone: Optional[str] = ""


class OrderCreate(BaseModel):
    ticket_type_id: str
    has_companion: bool = False
    companion: Optional[CompanionInfo] = None
    payment_method: Literal["pix", "credit_card"] = "pix"
    # Holder info captured for non-logged-in flows (optional)
    holder_name: Optional[str] = None
    holder_email: Optional[EmailStr] = None
    holder_cpf: Optional[str] = None
    holder_phone: Optional[str] = None


class IntegrationsConfig(BaseModel):
    pagbank_email: Optional[str] = ""
    pagbank_token: Optional[str] = ""
    pagbank_sandbox: bool = True
    pagbank_webhook_secret: Optional[str] = ""
    resend_api_key: Optional[str] = ""
    resend_sender: Optional[str] = "onboarding@resend.dev"


class TestConnectionResult(BaseModel):
    success: bool
    message: str
    details: Optional[dict] = None
