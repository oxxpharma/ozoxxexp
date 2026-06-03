from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal
from datetime import datetime, timezone
import uuid


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


UserRole = Literal["admin", "comercial", "financeiro", "credenciadora", "lider", "participante"]
OrderStatus = Literal["WAITING", "PAID", "IN_ANALYSIS", "DECLINED", "CANCELED", "REFUNDED", "COURTESY"]


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = ""
    cpf: Optional[str] = ""
    birth_date: Optional[str] = ""
    gender: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = "participante"
    phone: Optional[str] = ""
    cpf: Optional[str] = ""
    birth_date: Optional[str] = ""
    gender: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    phone: Optional[str] = None
    cpf: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
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
    logo_size: int = 32  # height in pixels (px)
    hero_side_image_url: Optional[str] = ""  # image rendered next to the hero title
    hero_secondary_logo_url: Optional[str] = ""  # logo/badge shown above the hero title
    primary_color: str = "#28b9fc"
    secondary_color: str = "#18245a"
    background_color: str = "#070b1e"
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
    marquee_words: List[str] = Field(default_factory=lambda: [
        "OZOXX EXPERIENCE",
        "SÃO PAULO 2026",
        "08•09 OUTUBRO",
        "ONDE EMOÇÃO ACONTECE",
        "EDIÇÃO INAUGURAL",
    ])


class TicketTypeCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    is_active: bool = True


class TicketTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


# LOTS — pricing tiers within a ticket type
class LotCreate(BaseModel):
    ticket_type_id: str
    name: str  # "1º Lote", "2º Lote", "VIP", "Founders"
    price: float
    quantity: int
    valid_until: Optional[str] = None  # ISO date — lot expires after this
    order: int = 0  # ordering (1st, 2nd, etc)
    is_active: bool = True


class LotUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    valid_until: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None


# COUPONS
class CouponCreate(BaseModel):
    code: str
    description: Optional[str] = ""
    discount_type: Literal["percent", "fixed"] = "percent"
    discount_value: float
    max_uses: Optional[int] = None  # null = unlimited
    valid_until: Optional[str] = None  # ISO
    is_active: bool = True


class CouponUpdate(BaseModel):
    description: Optional[str] = None
    discount_type: Optional[Literal["percent", "fixed"]] = None
    discount_value: Optional[float] = None
    max_uses: Optional[int] = None
    valid_until: Optional[str] = None
    is_active: Optional[bool] = None


# LEADERS
class LeaderCreate(BaseModel):
    user_id: str
    target_sales: int = 10  # tickets they must sell to earn their own
    slug: Optional[str] = None  # for /l/{slug} link


class LeaderUpdate(BaseModel):
    target_sales: Optional[int] = None
    slug: Optional[str] = None
    is_active: Optional[bool] = None


# EMAIL TEMPLATES
class EmailTemplate(BaseModel):
    name: str
    subject: str
    html: str
    description: Optional[str] = ""


class CustomEmailSend(BaseModel):
    subject: str
    html: str
    recipients: Literal["all", "paid_customers", "leaders", "specific"] = "all"
    user_ids: Optional[List[str]] = None  # for specific
    template_id: Optional[str] = None  # if used a template


# COMPANION + ORDER
class CompanionInfo(BaseModel):
    name: str
    email: EmailStr
    cpf: Optional[str] = ""
    phone: Optional[str] = ""


class UTMData(BaseModel):
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None
    referrer: Optional[str] = None
    leader_slug: Optional[str] = None


class OrderCreate(BaseModel):
    ticket_type_id: str
    lot_id: Optional[str] = None
    has_companion: bool = False
    companion: Optional[CompanionInfo] = None
    payment_method: Literal["pix", "credit_card"] = "pix"
    coupon_code: Optional[str] = None
    holder_name: Optional[str] = None
    holder_email: Optional[EmailStr] = None
    holder_cpf: Optional[str] = None
    holder_phone: Optional[str] = None
    holder_birth_date: Optional[str] = None
    holder_gender: Optional[str] = None
    holder_city: Optional[str] = None
    holder_state: Optional[str] = None
    utm: Optional[UTMData] = None


class ManualOrderCreate(BaseModel):
    """Admin creates a courtesy order directly."""
    holder_name: str
    holder_email: EmailStr
    holder_cpf: Optional[str] = ""
    holder_phone: Optional[str] = ""
    ticket_type_id: str
    lot_id: Optional[str] = None
    has_companion: bool = False
    companion: Optional[CompanionInfo] = None
    notes: Optional[str] = ""


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    notes: Optional[str] = ""


class IntegrationsConfig(BaseModel):
    pagbank_email: Optional[str] = ""
    pagbank_token: Optional[str] = ""
    pagbank_sandbox: bool = True
    pagbank_webhook_secret: Optional[str] = ""
    resend_api_key: Optional[str] = ""
    resend_sender: Optional[str] = "onboarding@resend.dev"


class PageViewCreate(BaseModel):
    path: str
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    referrer: Optional[str] = None
    leader_slug: Optional[str] = None
    session_id: Optional[str] = None
