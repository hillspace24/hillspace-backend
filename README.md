# HillSpace API

NestJS backend for an estate management marketplace.

## Stack

- NestJS + MongoDB (Mongoose)
- Argon2 password hashing
- JWT access + refresh tokens
- Cloudinary for listing images and verification documents
- Brevo transactional email (waitlist, signup verify, password reset)

## Features

| Module | What it does |
|--------|----------------|
| **Auth** | Register, login, refresh, logout, email verify + password reset OTP |
| **Waitlist** | Public join + welcome email; admin list/update |
| **Listings** | CRUD, publish, image upload |
| **Search** | Text + filters on `/api/listings` |
| **Verification** | KYC, agent, and listing document review |
| **Escrow** | Deal workflow without a live payment gateway |

### Escrow flow

`initiated → funded → inspection → released`  
Also supports `disputed`, `refunded`, and `cancelled`. Funding is recorded with a `fundingReference` (bank transfer / future gateway id) until Paystack/Stripe is wired in.

### Roles

`buyer` · `seller` · `agent` · `admin`

## Setup

```bash
cp .env.example .env
# fill MongoDB URI + Cloudinary + JWT + BREVO_API_KEY + verified sender

npm install
npm run start:dev
```

- API: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON (live): `http://localhost:3000/docs-json`
- OpenAPI file: [`docs/swagger.json`](docs/swagger.json)
- Postman collection: [`docs/HillSpace.postman_collection.json`](docs/HillSpace.postman_collection.json)
- Postman environment: [`docs/HillSpace.postman_environment.json`](docs/HillSpace.postman_environment.json)

### Import into Postman

1. Import `docs/HillSpace.postman_collection.json`
2. Import `docs/HillSpace.postman_environment.json` and select **HillSpace Local**
3. Run **Auth → Register** or **Login** — `accessToken` / `refreshToken` are saved automatically

Regenerate OpenAPI from a running MongoDB setup:

```bash
npm run swagger:export
```

## Main endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/verify-email`
- `POST /api/auth/request-verification-code`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-reset-otp`
- `POST /api/auth/reset-password`

### Waitlist
- `POST /api/waitlist` (sends welcome email via Brevo)
- `GET /api/waitlist/count`
- `GET /api/waitlist` (admin)
- `GET /api/waitlist/:id` (admin)
- `PATCH /api/waitlist/:id` (admin)
- `DELETE /api/waitlist/:id` (admin)

### Users
- `GET /api/users/me`
- `PATCH /api/users/me`

### Listings / Search
- `GET /api/listings?q=&city=&minPrice=&maxPrice=&propertyType=&purpose=`
- `GET /api/listings/:id`
- `POST /api/listings`
- `PATCH /api/listings/:id`
- `DELETE /api/listings/:id`
- `POST /api/listings/:id/images` (multipart `images`)
- `POST /api/listings/:id/publish`

### Verification
- `POST /api/verification` (multipart `documents` + `type` = `kyc` \| `agent` \| `listing`)
- `GET /api/verification/me`
- `GET /api/verification/pending` (admin)
- `PATCH /api/verification/:id/review` (admin)

### Escrow
- `POST /api/escrow`
- `GET /api/escrow/me`
- `GET /api/escrow/:id`
- `POST /api/escrow/:id/fund`
- `POST /api/escrow/:id/inspection`
- `POST /api/escrow/:id/release`
- `POST /api/escrow/:id/refund`
- `POST /api/escrow/:id/dispute`
- `POST /api/escrow/:id/cancel`

## Notes

- Email is sent through Brevo (`BREVO_API_KEY` + a verified `BREVO_SENDER_EMAIL`). Optional `BREVO_WAITLIST_LIST_ID` adds waitlist signups to a Brevo contact list.
- Admins cannot self-register as `admin` via the public register endpoint.
- Promote an admin by updating the user document in MongoDB.
- Escrow does not move real money yet — only tracks deal state for a future payment integration.
