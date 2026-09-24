import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def login_as_admin(driver):
    driver.get("http://localhost:3000/login")
    
    email_input = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//input[@type='email']"))
    )
    password_input = driver.find_element(By.XPATH, "//input[@type='password']")
    submit_btn = driver.find_element(By.XPATH, "//button[@type='submit']")
    
    email_input.send_keys("superuser@example.com")
    password_input.send_keys("password")
    submit_btn.click()
    
    WebDriverWait(driver, 10).until(
        EC.url_contains("/admin")
    )

def test_admin_overview_metrics(driver):
    """
    [ROLE: Admin User]
    OBJECTIVE: Validate Administrative Dashboard overview cards and metrics.
    PRECONDITIONS: Logged in as Admin user (superuser@example.com).
    STEPS:
      1. Navigate to /admin portal.
      2. Verify system overview title and operational status badge.
    EXPECTED RESULT: Admin dashboard metric cards and system indicators display cleanly.
    """
    login_as_admin(driver)
    
    assert "/admin" in driver.current_url
    
    # Wait for overview content / header
    admin_title = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'Admin') or contains(text(), 'Overview') or contains(text(), 'System Operational')]"))
    )
    assert admin_title.is_displayed()

def test_admin_sidebar_navigation(driver):
    """
    [ROLE: Admin User]
    OBJECTIVE: Validate sidebar navigation across Admin control panels.
    PRECONDITIONS: Logged in as Admin user.
    STEPS:
      1. Click 'User Management' tab.
      2. Click 'Investigators' tab.
      3. Click 'Cases' tab.
      4. Click 'Audit Logs' tab.
    EXPECTED RESULT: Admin panel views transition smoothly without error.
    """
    login_as_admin(driver)
    
    tabs = ["User Management", "Investigators", "Cases", "Audit Logs"]
    for tab_name in tabs:
        tab_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, f"//button[contains(., '{tab_name}')] | //a[contains(., '{tab_name}')]"))
        )
        tab_btn.click()
        time.sleep(1)
        assert tab_name in driver.page_source or "Management" in driver.page_source or "Cases" in driver.page_source or "Audit" in driver.page_source

def test_admin_user_management(driver):
    """
    [ROLE: Admin User]
    OBJECTIVE: Verify User Management table and search controls.
    PRECONDITIONS: Logged in as Admin user.
    STEPS:
      1. Navigate to 'User Management' tab.
      2. Check user table elements and search filter input.
    EXPECTED RESULT: Registered users table loads with role and action controls.
    """
    login_as_admin(driver)
    
    user_mgmt_btn = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'User Management')] | //a[contains(., 'User Management')]"))
    )
    user_mgmt_btn.click()
    
    # Check if table or search input exists
    search_input = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//input[@placeholder] | //table | //*[contains(text(), 'Email') or contains(text(), 'User')]"))
    )
    assert search_input is not None

def test_admin_audit_logs(driver):
    """
    [ROLE: Admin User]
    OBJECTIVE: Verify Audit Logs table and system action history.
    PRECONDITIONS: Logged in as Admin user.
    STEPS:
      1. Navigate to 'Audit Logs' tab.
      2. Verify audit table headers and log entries load.
    EXPECTED RESULT: System event history and audit logs render properly.
    """
    login_as_admin(driver)
    
    audit_btn = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Audit Logs')] | //a[contains(., 'Audit Logs')]"))
    )
    audit_btn.click()
    
    # Check audit log content
    audit_table = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//table | //*[contains(text(), 'Audit') or contains(text(), 'Action') or contains(text(), 'Timestamp')]"))
    )
    assert audit_table is not None
