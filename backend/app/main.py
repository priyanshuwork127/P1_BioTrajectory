
"""
BioTrajectory Backend Entrypoint
FastAPI application configuration, middleware, CORS, and route registration.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.qr import router as qr_router
from app.api.doctor_auth import router as doctor_auth_router
from app.api.health import router as health_router
from app.api.chat import router as chat_router
from app.api.history import router as history_router
from app.api.admin import router as admin_router
from app.api.family import router as family_router

from app.core.config import settings
from app.core.security import (
    initialize_firebase_admin,
    rate_limit_middleware,
)


# --------------------------------------------------
# LOGGING
# --------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger("biotrajectory.main")


# --------------------------------------------------
# APPLICATION LIFESPAN
# --------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""

    logger.info(
        f"Starting {settings.PROJECT_NAME} v{settings.VERSION}"
    )

    logger.info(
        f"Configured Groq Model: {settings.GROQ_MODEL}"
    )

    logger.info(
        f"Groq API Configured: {settings.is_groq_configured}"
    )

    logger.info(
        f"Firebase project configured: {settings.FIREBASE_PROJECT_ID}"
    )

    logger.info(
        f"Firebase Admin enabled: {initialize_firebase_admin()}"
    )

    logger.info(
        "CORS Allowed Origins: "
        "https://p1-bio-trajectory-nu.vercel.app, "
        "http://localhost:5173, "
        "http://127.0.0.1:5173"
    )

    yield

    logger.info("BioTrajectory backend shutting down.")


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "FastAPI Backend for BioTrajectory Health Intelligence "
        "and Groq AI Chatbot"
    ),
    lifespan=lifespan,
)


# --------------------------------------------------
# REQUEST SIZE & RATE LIMITING
# --------------------------------------------------

@app.middleware("http")
async def security_middleware(request: Request, call_next):
    """
    Apply request-size validation and rate limiting.

    CORS preflight requests are passed through without
    consuming rate-limit capacity.
    """

    if request.method == "OPTIONS":
        return await call_next(request)

    content_length = request.headers.get("content-length")

    if content_length:
        try:
            if (
                int(content_length)
                > settings.MAX_REQUEST_SIZE_BYTES
            ):
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content={
                        "detail": (
                            "Request payload exceeds maximum "
                            "allowed size."
                        )
                    },
                )

        except ValueError:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "detail": "Invalid Content-Length header."
                },
            )

    return await rate_limit_middleware(request, call_next)


# --------------------------------------------------
# GLOBAL EXCEPTION HANDLERS
# --------------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    """Handle request validation errors."""

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "detail": "Invalid request parameters.",
            "errors": [
                {
                    "loc": err.get("loc"),
                    "msg": err.get("msg"),
                }
                for err in exc.errors()
            ],
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(
    request: Request,
    exc: Exception,
):
    """Handle unexpected server errors."""

    logger.error(
        f"Unhandled server error on "
        f"{request.method} {request.url.path}: {exc}",
        exc_info=True,
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": (
                "An internal server error occurred. "
                "Please try your request again."
            )
        },
    )


# --------------------------------------------------
# ROUTER REGISTRATION
# --------------------------------------------------

app.include_router(health_router)
app.include_router(chat_router)
app.include_router(history_router)
app.include_router(doctor_auth_router)
app.include_router(admin_router)
app.include_router(family_router)
app.include_router(qr_router)


# --------------------------------------------------
# CORS CONFIGURATION
# --------------------------------------------------

# Wrap the complete FastAPI application.
# This ensures CORS headers are applied to error responses too.

app = CORSMiddleware(
    app=app,
    allow_origins=[
        "https://p1-bio-trajectory-nu.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600,
)
