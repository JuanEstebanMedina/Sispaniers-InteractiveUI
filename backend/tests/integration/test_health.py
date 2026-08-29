import pytest
from httpx import ASGITransport, AsyncClient

from sispaniers.infrastructure.config.composition import create_app


@pytest.fixture
async def client():
    transport = ASGITransport(app=create_app())
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


async def test_health_is_reachable(client):
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
