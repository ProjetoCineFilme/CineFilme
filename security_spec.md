# Security Specification for CineFilme

## Data Invariants
1. **Ratings**:
   - `user_id`: Integer, required.
   - `movie_id`: Integer, required.
   - `rating`: Number (1-5), required.
2. **Movies**:
   - `movie_id`: Integer, required.
   - `title`: String, required.

## Access Patterns
- **Read**: Public (for simplicity in this recommendation demo).
- **Write**: Authenticated users can create ratings. 

## Testing Payloads
1. Setting rating > 5 (Rejected)
2. Setting rating < 1 (Rejected)
3. Missing user_id (Rejected)
4. Valid rating (Allowed)
