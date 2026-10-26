# Aurora: Existing User Registration Test
import os
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class TestRegister:
    def setup_method(self):
        options = webdriver.ChromeOptions()
        self.driver = webdriver.Chrome(options=options)
        self.wait = WebDriverWait(self.driver, 10)

    def teardown_method(self):
        self.driver.quit()

    def test_register_existing_user(self):
        """Verify that duplicate email registration is rejected."""
        base_url = os.getenv(
            "AURORA_URL", "http://localhost:3000"
        )
        email = os.getenv("AURORA_EXISTING_TEST_EMAIL")

        assert email, "Set AURORA_EXISTING_TEST_EMAIL"

        self.driver.get(f"{base_url}/register")

        # Fill registration form
        self.fill_input("full_name", "Aurora Test User")
        self.fill_input("email", email)
        self.fill_input("phone", "9876543210")
        self.fill_input("password", "TestPassword@123")
        self.fill_input("confirm_password", "TestPassword@123")

        # Submit registration
        submit_button = self.wait.until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, "button[type='submit']")
            )
        )
        submit_button.click()

        # Verify duplicate email error
        error_message = self.wait.until(
            EC.visibility_of_element_located(
                (By.CSS_SELECTOR, "[role='alert']")
            )
        )

        assert (
            "already" in error_message.text.lower()
            or "exists" in error_message.text.lower()
            or "registered" in error_message.text.lower()
        ), f"Unexpected message: {error_message.text}"

    def fill_input(self, name, value):
        field = self.wait.until(
            EC.visibility_of_element_located(
                (By.NAME, name)
            )
        )
        field.clear()
        field.send_keys(value)
