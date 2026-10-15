"""Service layer: business logic, kept out of the route handlers.

A route handler orchestrates — it reads the request, calls one of these, and
returns. Anything that decides something (does this password match, does this
run get a report) lives here, where it can be called from a test without an HTTP
client in the way.
"""
