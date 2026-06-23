# OnlyMyPDF — API Reference

Base: `/api` (v1 implicit). JSON. Auth via Bearer (Sanctum) where noted. Public/guest endpoints
accept an `X-Session-Token` header (device/session fingerprint) for rate limiting.

## Auth
| Method | Path | Auth | Body / notes |
|--------|------|------|--------------|
| POST | `/auth/register` | – | `{name,email,password}` → sends verify email |
| POST | `/auth/login` | – | `{email,password}` → token |
| POST | `/auth/google` | – | `{id_token}` → token (creates/links account) |
| POST | `/auth/logout` | ✓ | revoke token |
| POST | `/auth/email/verify/{id}/{hash}` | – | verification link |
| POST | `/auth/email/resend` | ✓ | resend verification |
| POST | `/auth/password/forgot` | – | `{email}` |
| POST | `/auth/password/reset` | – | `{token,email,password}` |
| GET  | `/auth/me` | ✓ | current user + plan + credits |

## Tools & metadata
| GET | `/tools` | – | list of enabled tools (code, category, costs, flags, slugs, i18n names) |
| GET | `/tools/{code}` | – | single tool detail + SEO + FAQ |
| GET | `/feature-flags` | – | public flags map |
| GET | `/translations/{locale}` | – | message catalog overrides |

## Jobs (server-side processing)
| POST | `/jobs/initiate` | opt | `{tool_code, mode, options, file_meta}` → `{job_uuid, upload_url}` |
| POST | `/jobs/{uuid}/upload` | opt | multipart file → validates (mime/ext/size/structure) |
| GET  | `/jobs/{uuid}/status` | opt | progress state + quality_score + messages (poll/SSE) |
| GET  | `/jobs/{uuid}/detection` | opt | smart-detection result (digital/scanned, tables, etc.) |
| GET  | `/jobs/{uuid}/download` | opt | 302 → **signed, expiring** URL |
| POST | `/jobs/{uuid}/delete-now` | opt | immediate purge of input+output |
| POST | `/jobs/{uuid}/rescue` | opt | retry with High Accuracy / OCR (confirms extra credits) |

### `/jobs/{uuid}/status` response
```json
{
  "uuid": "…",
  "status": "processing",
  "step": 5,
  "step_label": "Processing",
  "quality_estimate": 86,
  "messages": ["Complex table detected", "High Accuracy Mode is being used…"],
  "expires_at": "2026-06-23T15:00:00Z",
  "download_ready": false
}
```

## Credits
| GET | `/credits/balance` | ✓ | `{balance, resets_at}` |
| POST | `/credits/preview` | opt | `{tool_code, mode, file_meta}` → `{estimate_min, estimate_max}` |
| GET | `/credits/ledger` | ✓ | paginated history |

## Dashboard
| GET | `/dashboard/overview` | ✓ | credits, plan, trial days, usage today/month |
| GET | `/dashboard/history` | ✓ | file_metadata (paginated) |
| GET | `/dashboard/invoices` | ✓ | invoice list |
| GET | `/invoices/{id}/download` | ✓ | regenerated invoice PDF |

## Payments
| POST | `/checkout/razorpay` | ✓ | `{plan_code, coupon?}` → razorpay order |
| POST | `/checkout/paypal` | ✓ | `{plan_code, coupon?}` → paypal order |
| POST | `/webhooks/razorpay` | sig | verified webhook (signature header) |
| POST | `/webhooks/paypal` | sig | verified webhook |
| POST | `/subscription/cancel` | ✓ | cancel at period end |

## Support
| POST | `/support/contact` | – | public contact form → creates ticket (rate-limited) |
| GET  | `/support/tickets` | ✓ | user tickets |
| POST | `/support/tickets` | ✓ | create ticket |
| POST | `/support/tickets/{id}/reply` | ✓ | add message |

## Admin (under `/api/admin`, admin guard)
Filament provides the UI; these power any headless needs. Modules mirror the admin panel
(users, plans, subscriptions, payments, invoices, credits, jobs, failed jobs, errors, AI/OCR
usage, provider usage, benchmark lab, coupons, ads, support, analytics, rate limits, guest usage,
trial abuse, feature flags, tool toggles, file-size limits, credit costs, content, SEO, legal).

## Standard error envelope
```json
{ "error": { "code": "FILE_TOO_LARGE", "message": "This file is larger than your plan allows (25 MB).", "hint": "Upgrade to Pro for up to 500 MB." } }
```
Common codes: `FILE_TOO_LARGE`, `UNSUPPORTED_FILE`, `PASSWORD_REQUIRED`, `CONVERSION_FAILED`,
`OCR_REQUIRED`, `TOO_COMPLEX_FAST_MODE`, `DAILY_LIMIT_REACHED`, `INSUFFICIENT_CREDITS`,
`JOB_TIMEOUT`, `AUTO_DELETE_COMPLETED`, `DOWNLOAD_EXPIRED`.
