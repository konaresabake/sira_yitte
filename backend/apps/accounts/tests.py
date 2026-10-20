from django.core.cache import cache
from rest_framework.test import APITestCase

from apps.core.testing import make_admin, make_customer


class AuthTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_register_creates_customer_and_returns_tokens(self):
        r = self.client.post("/api/auth/register/", {"email": "New@Test.sn", "password": "Un-bon-mdp-2026", "first_name": "Fatou"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["user"]["email"], "new@test.sn")
        self.assertEqual(r.data["user"]["role"], "client")
        self.assertIn("access", r.data)

    def test_register_rejects_weak_password_and_duplicates(self):
        make_customer("dup@test.sn")
        self.assertEqual(self.client.post("/api/auth/register/", {"email": "x@test.sn", "password": "12345678"}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/auth/register/", {"email": "DUP@test.sn", "password": "Un-bon-mdp-2026"}, format="json").status_code, 400)

    def test_login_returns_jwt_and_profile(self):
        make_admin()
        r = self.client.post("/api/auth/login/", {"email": "ADMIN@test.sn", "password": "Admin-pass-123"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["access"] and r.data["refresh"])
        self.assertTrue(r.data["user"]["is_staff"])

    def test_login_wrong_password(self):
        make_admin()
        self.assertEqual(self.client.post("/api/auth/login/", {"email": "admin@test.sn", "password": "mauvais"}, format="json").status_code, 401)

    def test_me_requires_token_and_can_update_profile(self):
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
        user = make_customer()
        self.client.force_authenticate(user)
        r = self.client.patch("/api/auth/me/", {"phone": "+221 77 585 73 58", "role": "admin", "is_staff": True}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["phone"], "775857358")
        self.assertEqual(r.data["role"], "client")  # un client ne peut pas s'élever en administrateur
        self.assertFalse(r.data["is_staff"])

    def test_logout_blacklists_refresh_token(self):
        make_admin()
        tokens = self.client.post("/api/auth/login/", {"email": "admin@test.sn", "password": "Admin-pass-123"}, format="json").data
        self.assertEqual(self.client.post("/api/auth/logout/", {"refresh": tokens["refresh"]}, format="json").status_code, 204)
        self.assertEqual(self.client.post("/api/auth/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code, 401)

    def test_refresh_rotates_token(self):
        make_admin()
        tokens = self.client.post("/api/auth/login/", {"email": "admin@test.sn", "password": "Admin-pass-123"}, format="json").data
        r = self.client.post("/api/auth/refresh/", {"refresh": tokens["refresh"]}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertNotEqual(r.data["refresh"], tokens["refresh"])
