# Aurora - Add Evidence Test using Selenium
import os
import pytest
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class TestAddEvidence:

    def setup_method(self):
        """Set up WebDriver before each test."""
        options = webdriver.ChromeOptions()
        self.driver = webdriver.Chrome(options=options)
        self.driver.maximize_window()
        self.wait = WebDriverWait(self.driver, 15)

    def teardown_method(self):
        """Close WebDriver after each test."""
        self.driver.quit()

    def test_add_evidence(self):
        """Test uploading an evidence image to an existing case."""

        base_url = os.getenv(
            "AURORA_URL",
            "https://dip-frontend-npczgoxg.onslate.in"
        )
        email = os.getenv("AURORA_TEST_EMAIL")
        password = os.getenv("AURORA_TEST_PASSWORD")
        case_url = os.getenv("AURORA_TEST_CASE_URL")
        evidence_path = os.getenv("AURORA_TEST_EVIDENCE_PATH")

        assert email and password, (
            "Set AURORA_TEST_EMAIL and AURORA_TEST_PASSWORD"
        )
        assert case_url, "Set AURORA_TEST_CASE_URL"
        assert evidence_path and Path(evidence_path).is_file(), (
            "Set AURORA_TEST_EVIDENCE_PATH to an existing test image"
        )

        # Open Aurora login page
        self.driver.get(f"{base_url}/login")

        # Enter login credentials
        self.fill_input("email", email)
        self.fill_input("password", password)

        # Submit login form
        self.click_button("button[type='submit']")

        # Wait for successful navigation after login
        self.wait.until(
            lambda driver: "/login" not in driver.current_url
        )

        # Open an existing test case
        self.driver.get(case_url)

        # Locate evidence upload input
        file_input = self.wait.until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "input[type='file']")
            )
        )
        file_input.send_keys(str(Path(evidence_path).resolve()))

        # Click upload/submit button
        self.click_button("button[type='submit']")

        # Verify successful upload using an application-specific message
        success_message = self.wait.until(
            EC.visibility_of_element_located(
                (By.CSS_SELECTOR, "[role='status'], .success-message")
            )
        )

        assert success_message.is_displayed()
        assert (
            "upload" in success_message.text.lower()
            or "success" in success_message.text.lower()
            or "evidence" in success_message.text.lower()
        ), f"Unexpected message: {success_message.text}"

    def fill_input(self, name, value):
        """Enter text into a form field."""
        field = self.wait.until(
            EC.visibility_of_element_located((By.NAME, name))
        )
        field.clear()
        field.send_keys(value)

    def click_button(self, selector):
        """Wait for a button and click it."""
        button = self.wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
        )
        button.click()
