"""
Run this script ONCE locally to get your Google Drive refresh token.
It will open your browser, ask you to log in with your Google account,
and print the refresh token to paste into Render.

Usage:
    pip install google-auth-oauthlib
    python get_refresh_token.py

You will need your OAuth2 Client ID and Secret from Google Cloud Console.
"""

import json
from google_auth_oauthlib.flow import InstalledAppFlow

# ── Paste your Client ID and Secret from Google Cloud Console ──
CLIENT_ID     = "YOUR_CLIENT_ID_HERE"
CLIENT_SECRET = "YOUR_CLIENT_SECRET_HERE"
# ──────────────────────────────────────────────────────────────

SCOPES = ["https://www.googleapis.com/auth/drive"]

client_config = {
    "installed": {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
}

flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
creds = flow.run_local_server(port=0)

print("\n" + "="*60)
print("✅ SUCCESS! Add these to your Render environment variables:")
print("="*60)
print(f"\nGOOGLE_CLIENT_ID      = {CLIENT_ID}")
print(f"GOOGLE_CLIENT_SECRET  = {CLIENT_SECRET}")
print(f"GOOGLE_REFRESH_TOKEN  = {creds.refresh_token}")
print("\n" + "="*60)
