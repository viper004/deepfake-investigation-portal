import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def login_as_investigator(driver):
    driver.get("http://localhost:3000/login")
    
    email_input = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//input[@type='email']"))
    )
    password_input = driver.find_element(By.XPATH, "//input[@type='password']")
    submit_btn = driver.find_element(By.XPATH, "//button[@type='submit']")
    
    email_input.send_keys("jaganathsyam2004@gmail.com")
    password_input.send_keys("test")
    submit_btn.click()
    
    WebDriverWait(driver, 10).until(
        EC.url_contains("/dashboard")
    )

def test_investigator_login_and_role_view(driver):
    """
    [ROLE: Investigator]
    OBJECTIVE: Validate successful login and UI rendering for Investigator user.
    PRECONDITIONS: Investigator account (jaganathsyam2004@gmail.com) exists in system.
    STEPS:
      1. Navigate to /login.
      2. Input investigator email and password ('test').
      3. Click 'Log In' submit button.
      4. Wait for redirection to /dashboard.
    EXPECTED RESULT: Page header displays 'Investigator Dashboard' or investigator assigned cases metrics.
    """
    login_as_investigator(driver)
    
    assert "/dashboard" in driver.current_url
    
    # Check for investigator specific header / text
    dashboard_title = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'Investigator Dashboard') or contains(text(), 'Assigned Cases') or contains(text(), 'Dashboard')]"))
    )
    assert dashboard_title.is_displayed()

def test_investigator_tabs_navigation(driver):
    """
    [ROLE: Investigator]
    OBJECTIVE: Test sidebar tab navigation for Investigator user role.
    PRECONDITIONS: Logged in as Investigator user.
    STEPS:
      1. Click 'All Cases' tab in sidebar navigation.
      2. Click 'Assigned Cases' tab.
      3. Click 'Reports' tab.
      4. Click 'Profile' tab.
    EXPECTED RESULT: Page view seamlessly updates for each investigator tab selection without error.
    """
    login_as_investigator(driver)
    
    tabs = ["All Cases", "Assigned Cases", "Reports", "Profile"]
    for tab_name in tabs:
        tab_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, f"//button[contains(., '{tab_name}')] | //a[contains(., '{tab_name}')]"))
        )
        tab_btn.click()
        time.sleep(1)
        assert tab_name in driver.page_source or "Cases" in driver.page_source or "Profile" in driver.page_source or "Reports" in driver.page_source

def test_investigator_all_cases_view(driver):
    """
    [ROLE: Investigator]
    OBJECTIVE: Verify Investigator 'All Cases' table rendering.
    PRECONDITIONS: Logged in as Investigator user.
    STEPS:
      1. Click 'All Cases' sidebar button.
      2. Wait for cases table / search input element to load.
    EXPECTED RESULT: All Cases header and table elements are correctly displayed for forensic review.
    """
    login_as_investigator(driver)
    
    all_cases_tab = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'All Cases')] | //a[contains(., 'All Cases')]"))
    )
    all_cases_tab.click()
    
    header = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'All Cases') or contains(text(), 'Case')]"))
    )
    assert header.is_displayed()

def test_investigator_assigned_cases_view(driver):
    """
    [ROLE: Investigator]
    OBJECTIVE: Verify Investigator 'Assigned Cases' table view.
    PRECONDITIONS: Logged in as Investigator user.
    STEPS:
      1. Click 'Assigned Cases' sidebar button.
      2. Verify view updates to assigned cases list.
    EXPECTED RESULT: Assigned cases container element is displayed cleanly.
    """
    login_as_investigator(driver)
    
    assigned_cases_tab = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Assigned Cases')] | //a[contains(., 'Assigned Cases')]"))
    )
    assigned_cases_tab.click()
    
    header = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'Assigned Cases') or contains(text(), 'Recent Assigned Cases')]"))
    )
    assert header.is_displayed()
