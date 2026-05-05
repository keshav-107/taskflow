from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings
from routers import auth, vendors, tasks, files

settings = get_settings()

app = FastAPI(
    title="Task Assignment API",
    description="Secure task assignment platform for business owner and vendors.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_origin_regex=r"https://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api")
app.include_router(vendors.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(files.router, prefix="/api")


@app.get("/")
async def health():
    return {"status": "ok", "service": "Task Assignment API v1.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
