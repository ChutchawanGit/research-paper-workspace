# 0002. Secure-by-Default Access with Tokenized Share Links

All user data (Papers, Collections, Highlights, Notes) is strictly private and isolated by `user_id`, requiring authenticated JWT sessions to access. Unauthenticated visitors can only view a specific Paper and its notes if the owner explicitly generates a cryptographically unguessable Share Link (read-only token). This guarantees zero accidental data leakage while enabling seamless sharing for portfolio reviews.
