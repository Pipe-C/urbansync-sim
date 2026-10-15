"""Shared schema behaviour.

The frontend's types are camelCase (`displayName`, `quietRatePerMinute`,
`averageWaitSeconds`), so every API schema speaks camelCase on the wire while the
Python attributes stay snake_case. `populate_by_name` keeps the snake_case name
valid on input too, so tests and internal callers can use either.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base for every request/response body. camelCase out, either case in."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
