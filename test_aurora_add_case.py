import os
import time
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class TestAddCase:

    def setup_method(self):
        """Set up WebDriver before each test."""
        options = webdriver.ChromeOptions()
        # Headless mode for smooth terminal/CI execution
        if os.getenv("HEADLESS", "true").lower() != "false":
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1920,1080")
        self.driver = webdriver.Chrome(options=options)
        self.driver.maximize_window()
        self.wait = WebDriverWait(self.driver, 20)

    def teardown_method(self):
        """Close WebDriver after each test."""
        self.driver.quit()

    def test_add_case(self):
        driver = self.driver
        wait = self.wait

        base_url = os.getenv(
            "AURORA_URL",
            "https://aurora.onslate.in"
        )
        email = os.getenv("AURORA_TEST_EMAIL", "jane.cooper@fbi.gov")
        password = os.getenv("AURORA_TEST_PASSWORD", "password123")

        assert email and password, (
            "Set AURORA_TEST_EMAIL and AURORA_TEST_PASSWORD"
        )

        # Step 1: Open Aurora
        driver.get(f"{base_url}/login")

        # Step 2: Login
        wait.until(
            EC.visibility_of_element_located((By.NAME, "email"))
        ).send_keys(email)

        wait.until(
            EC.visibility_of_element_located((By.NAME, "password"))
        ).send_keys(password)

        wait.until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, "button[type='submit']")
            )
        ).click()

        # Step 3: Wait for successful login
        wait.until(lambda d: "/login" not in d.current_url)

        # Step 4: Navigate to case management
        wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//nav//button[contains(., 'Cases')] | //button[contains(normalize-space(), 'Cases')] | //*[self::button or self::a][contains(normalize-space(), 'Cases')]")
            )
        ).click()

        # Step 5: Open the create-case form
        wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//button[contains(normalize-space(), 'New Case') or contains(normalize-space(), 'Create Case')] | //*[self::button or self::a][contains(normalize-space(), 'New Case') or contains(normalize-space(), 'Create Case')]")
            )
        ).click()

        # Step 6: Fill case details
        title_input = wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//input[@name='title'] | //form//input[@type='text']")
            )
        )
        title_input.clear()
        title_input.send_keys("Selenium Test Investigation")

        description = wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//textarea[@name='description'] | //form//textarea")
            )
        )
        description.clear()
        description.send_keys(
            "Automated test case for Aurora investigation workflow."
        )

        # Step 7: Submit the form
        wait.until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, "form button[type='submit'], button[type='submit']")
            )
        ).click()

        # Step 8: Verify success
        success = wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//*[@role='status'] | //*[@role='alert'] | //*[contains(text(), 'case created successfully') or contains(text(), 'Investigation case created successfully')]")
            )
        )

        assert success.is_displayed(), (
            "Case creation confirmation was not displayed."
        )
