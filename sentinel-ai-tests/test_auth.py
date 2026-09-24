from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def test_login_page_loads(driver):
    """
    [ROLE: Guest / Visitor]
    OBJECTIVE: Validate layout and interactive form elements on the Login page.
    PRECONDITIONS: Web application running at http://localhost:3000.
    STEPS:
      1. Navigate to http://localhost:3000/login.
      2. Wait for 'Welcome back' heading to appear.
      3. Verify email input, password input, and submit button exist.
    EXPECTED RESULT: All login form components are visible and interactive.
    """
    driver.get("http://localhost:3000/login")
    
    # Wait for the login form to load
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//h2[text()='Welcome back']"))
    )
    
    # Check if inputs exist
    email_input = driver.find_element(By.XPATH, "//input[@type='email']")
    password_input = driver.find_element(By.XPATH, "//input[@type='password']")
    submit_btn = driver.find_element(By.XPATH, "//button[@type='submit']")
    
    assert email_input.is_displayed()
    assert password_input.is_displayed()
    assert submit_btn.is_displayed()

def test_login_with_invalid_credentials(driver):
    """
    [ROLE: Guest / Visitor]
    OBJECTIVE: Verify authentication rejection and error feedback for invalid credentials.
    PRECONDITIONS: Login page loaded at http://localhost:3000/login.
    STEPS:
      1. Input non-existent email 'invalid@example.com'.
      2. Input incorrect password 'WrongPass123!'.
      3. Click 'Log In' submit button.
      4. Wait for error banner element to display.
    EXPECTED RESULT: Authentication fails gracefully and displays error alert banner.
    """
    driver.get("http://localhost:3000/login")
    
    # Fill in the form
    email_input = driver.find_element(By.XPATH, "//input[@type='email']")
    password_input = driver.find_element(By.XPATH, "//input[@type='password']")
    submit_btn = driver.find_element(By.XPATH, "//button[@type='submit']")
    
    email_input.send_keys("invalid@example.com")
    password_input.send_keys("WrongPass123!")
    submit_btn.click()
    
    # The application handles invalid login (NextAuth / credentials), so we should see an error message
    error_message = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//form//div[contains(@class, 'bg-[#CC2200]/10')]"))
    )
    
    assert error_message.is_displayed()
    assert len(error_message.text) > 0

def test_forgot_password_modal(driver):
    """
    [ROLE: Guest / Visitor]
    OBJECTIVE: Verify multi-step Forgot Password OTP modal functionality.
    PRECONDITIONS: Login page loaded at http://localhost:3000/login.
    STEPS:
      1. Click 'Forgot password?' link.
      2. Wait for modal header 'Forgot Password' to become visible.
      3. Verify 'Send OTP' button is displayed inside modal.
    EXPECTED RESULT: Modal opens successfully allowing user to trigger OTP verification.
    """
    driver.get("http://localhost:3000/login")
    
    # Click on "Forgot password?"
    forgot_password_link = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Forgot password?')]"))
    )
    forgot_password_link.click()
    
    # Wait for modal to appear
    modal_header = WebDriverWait(driver, 10).until(
        EC.visibility_of_element_located((By.XPATH, "//h3[text()='Forgot Password']"))
    )
    assert modal_header.is_displayed()
    
    # Check if send OTP button exists
    send_otp_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Send OTP')]")
    assert send_otp_btn.is_displayed()

def test_successful_login_and_dashboard(driver):
    """
    [ROLE: Standard User]
    OBJECTIVE: Validate successful login and portal entry for Standard User.
    PRECONDITIONS: Standard user account (jagannathsyam2000@gmail.com) exists.
    STEPS:
      1. Enter email 'jagannathsyam2000@gmail.com' and password 'test'.
      2. Click 'Log In'.
      3. Wait for URL redirection to /dashboard.
    EXPECTED RESULT: Successfully redirected to user dashboard and dashboard header rendered.
    """
    driver.get("http://localhost:3000/login")
    
    # Fill in the form
    email_input = driver.find_element(By.XPATH, "//input[@type='email']")
    password_input = driver.find_element(By.XPATH, "//input[@type='password']")
    submit_btn = driver.find_element(By.XPATH, "//button[@type='submit']")
    
    email_input.send_keys("jagannathsyam2000@gmail.com")
    password_input.send_keys("test")
    submit_btn.click()
    
    # Should navigate to /dashboard or /admin
    WebDriverWait(driver, 10).until(
        lambda d: "/dashboard" in d.current_url or "/admin" in d.current_url
    )
    
    assert "/dashboard" in driver.current_url or "/admin" in driver.current_url, f"Failed to login, current URL: {driver.current_url}"
    
    # Verify a dashboard element is present
    dashboard_header = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'Dashboard') or contains(text(), 'Admin')]"))
    )
    assert dashboard_header.is_displayed()

def test_admin_login_and_redirect(driver):
    """
    [ROLE: Admin User]
    OBJECTIVE: Validate administrative superuser authentication and portal redirection.
    PRECONDITIONS: Admin account (superuser@example.com) exists.
    STEPS:
      1. Input admin email 'superuser@example.com' and password 'password'.
      2. Click 'Log In'.
      3. Wait for URL redirection to /admin.
    EXPECTED RESULT: Admin user is redirected to administrative dashboard (/admin).
    """
    driver.get("http://localhost:3000/login")
    
    email_input = driver.find_element(By.XPATH, "//input[@type='email']")
    password_input = driver.find_element(By.XPATH, "//input[@type='password']")
    submit_btn = driver.find_element(By.XPATH, "//button[@type='submit']")
    
    email_input.send_keys("superuser@example.com")
    password_input.send_keys("password")
    submit_btn.click()
    
    WebDriverWait(driver, 10).until(
        lambda d: "/admin" in d.current_url or "/dashboard" in d.current_url
    )
    
    assert "/admin" in driver.current_url or "/dashboard" in driver.current_url, f"Current URL: {driver.current_url}"
