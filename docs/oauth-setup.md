# OAuth Setup Guide for Social Logins

This document guides you through setting up Google and Facebook OAuth applications to enable social logins locally in **NotAnotherCards**.

---

## 🚀 Overview

Social authentication in NotAnotherCards is powered by **Better Auth**. To test these login features locally, you need to register developer accounts and create applications on the Google Cloud Console and Meta (Facebook) for Developers platform. 

Once created, you will obtain the client IDs and secrets to configure in your local environment files (`.env` and `apps/api/.env`).

---

## 1. Google OAuth Setup

Follow these steps to obtain a `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`:

### Step 1: Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your Google account.
3. Click the project dropdown in the top navigation bar and select **New Project**.
4. Give your project a name (e.g., `NotAnotherCards Dev`) and click **Create**.

### Step 2: Configure the OAuth Consent Screen
1. In the top left-hand hambuger menu, under to **APIs & Services**, go to **Credentials**.
2. Press **Create Credentials** -> **OAuth client ID**
3. Follow the wizard step-by-step:
   - **Configure consent screen** -> **Get Started**.
   - **App information**: Give your project a name (e.g., `NotAnotherCards Local`) and select a user support email.
   - **Audience**: Under the Audience section, configure the user type. Select **External** (this is where the External configuration now lives) so any Google user can access it.
   - **Contact information**: Enter developer contact emails.
4. Click **Save and Continue** (you can skip adding Scopes and Test Users for local development).

### Step 3: Create OAuth 2.0 Credentials
1. Go to **Clients** in the left sidebar under the Google Auth Platform navigation.
2. Click **Create Client**.
3. Choose **Web application** as the Application Type.
4. Set the name to `Local Dev Client`.
5. Under **Authorized JavaScript origins**, click **+ Add URI** and add:
   - `http://localhost:5173` *(Frontend Dev Server)*
   - `http://localhost:3000` *(Backend API Server)*
6. Under **Authorized redirect URIs**, click **+ Add URI** and add:
   - `http://localhost:3000/api/auth/callback/google` *(Direct Backend Callback)*
   - `http://localhost:5173/api/auth/callback/google` *(Proxied Frontend Callback)*
7. Click **Create**.
8. Copy the **Client ID** and **Client Secret** from the details page or modal that appears.

---

## 2. Facebook (Meta) OAuth Setup

Follow these steps to obtain a `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET`:

### Step 1: Create a Meta Developer App
1. Go to the [Meta for Developers Portal](https://developers.facebook.com/).
2. Log in and click **My Apps** in the top right.
3. Click **Create App**.
4. Choose the use-case or type. Select **Authenticate and duplicate data with Facebook Login** (or **Consumer** / **Other** depending on current Meta UI layout options).
5. Provide an App Name (e.g., `NotAnotherCards Dev`), enter your contact email, and click **Create app**.

### Step 2: Set up Facebook Login Product
1. On the App Dashboard, find **Facebook Login** and click **Set Up / Configure**.
2. Choose **Web** as the platform.
3. You can skip the Quickstart steps and click **Settings** under the **Facebook Login** navigation menu on the left sidebar.
4. Under **Client OAuth Settings**, locate **Valid OAuth Redirect URIs** and enter:
   - `http://localhost:3000/api/auth/callback/facebook`
   - `http://localhost:5173/api/auth/callback/facebook`
5. Click **Save Changes** at the bottom of the page.

### Step 3: Retrieve Credentials
1. In the left-hand sidebar, navigate to **App Settings** > **Basic**.
2. Here you will find the **App ID** (which serves as your `FACEBOOK_CLIENT_ID`).
3. Click **Show** next to the **App Secret** (which serves as your `FACEBOOK_CLIENT_SECRET`) and enter your password to copy it.

---

## 3. Environment Configuration

Once you have gathered the credentials, update your environment files.

> [!IMPORTANT]
> Keep your secrets secure and never commit actual client secrets to the Git repository.

### For Local Development (No Docker Container)
Add the keys to your `apps/api/.env` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Facebook OAuth
FACEBOOK_CLIENT_ID=your_facebook_app_id
FACEBOOK_CLIENT_SECRET=your_facebook_app_secret
```

### For Docker Compose Development
Add the same variables to the root `.env` file at the repository root, so that the API container can read them:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Facebook OAuth
FACEBOOK_CLIENT_ID=your_facebook_app_id
FACEBOOK_CLIENT_SECRET=your_facebook_app_secret
```

---

## 4. 🌐 Deployed Environments (Production/Staging)

To get social logins working on a deployed instance:
1. **Google Console Credentials**: In the same Google client configuration (or a new production-specific client), add your deployment's URLs:
   - **Authorized JavaScript origins**: `https://cards.dustyway.org`
   - **Authorized redirect URIs**: `https://cards.dustyway.org/api/auth/callback/google` (and Facebook callback URI `https://cards.dustyway.org/api/auth/callback/facebook` for Facebook).
2. **Environment Variables**: Configure the `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, and `FACEBOOK_CLIENT_SECRET` environment variables in your server's deployment or Docker Compose configuration exactly as shown in [Section 3](#3-environment-configuration).

---

## 🔗 Technical Details & Callback Handling

1. **How Redirects Work**:
   When a user clicks "Login with Google", the client initiates the flow through Better Auth. Better Auth redirects the user's browser to the provider's consent page. Once authorized, the provider redirects the browser to the registered callback URI.
2. **Backend Proxying**:
   The React client communicates with the NestJS backend via a Vite proxy mapping `/api` to `http://localhost:3000`. Therefore, redirects configured to either the frontend port (`5173`) or backend port (`3000`) will hit the Better Auth endpoint controller.
