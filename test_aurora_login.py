# Aurora Login Test using Selenium
import os
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class TestLogin:
    def setup_method(self):
        options = webdriver.ChromeOptions()
        self.driver = webdriver.Chrome(options=options)
        self.driver.maximize_window()
        self.wait = WebDriverWait(self.driver, 10)

    def teardown_method(self):
        self.driver.quit()

    def test_login(self):
        base_url = os.getenv(
            "AURORA_URL",
            "http://localhost:3000"
        )
        email = os.getenv("AURORA_TEST_EMAIL")
        password = os.getenv("AURORA_TEST_PASSWORD")

        assert email and password, (
            "Set AURORA_TEST_EMAIL and AURORA_TEST_PASSWORD"
        )

        self.driver.get(f"{base_url}/login")

        # Enter email
        email_field = self.wait.until(
            EC.visibility_of_element_located(
                (By.NAME, "email")
            )
        )
        email_field.send_keys(email)

        # Enter password
        password_field = self.wait.until(
            EC.visibility_of_element_located(
                (By.NAME, "password")
            )
        )
        password_field.send_keys(password)

        # Submit login form
        login_button = self.wait.until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, "button[type='submit']")
            )
        )
        login_button.click()

        # Verify successful login using an application-specific element
        self.wait.until(
            EC.url_contains("/dashboard")
        )
