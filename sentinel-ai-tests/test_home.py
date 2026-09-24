from selenium.webdriver.common.by import By

def test_sentinel_homepage_title_and_header(driver):
    """
    [ROLE: Guest / Visitor]
    OBJECTIVE: Validate Sentinel AI Landing Page title and main headline text.
    PRECONDITIONS: Web application is running at http://localhost:3000.
    STEPS:
      1. Open browser and navigate to http://localhost:3000.
      2. Verify page title is non-empty.
      3. Inspect main <h1> hero section for headline 'Expose deepfakes'.
      4. Verify 'Get started' CTA button presence.
    EXPECTED RESULT: Landing page hero section and CTA buttons are rendered correctly.
    """
    driver.get("http://localhost:3000")
    
    assert "Sentinel" in driver.title or driver.title != "", "Title should not be empty"
    
    # Check for the main hero text
    header = driver.find_element(By.TAG_NAME, "h1")
    assert "Expose deepfakes" in header.text, f"Expected 'Expose deepfakes' in header, got '{header.text}'"
    
    # Check if 'Get started' link exists
    get_started_buttons = driver.find_elements(By.XPATH, "//a[contains(text(), 'Get started')]")
    assert len(get_started_buttons) > 0, "'Get started' button not found"

def test_homepage_navigation_to_login(driver):
    """
    [ROLE: Guest / Visitor]
    OBJECTIVE: Validate navigation from Landing Page to Login Portal.
    PRECONDITIONS: Web application is running at http://localhost:3000.
    STEPS:
      1. Navigate to http://localhost:3000.
      2. Click 'Get started' navigation button.
      3. Wait for client-side navigation to complete.
    EXPECTED RESULT: Browser URL updates to http://localhost:3000/login.
    """
    driver.get("http://localhost:3000")
    
    # Click on Get started
    get_started_btn = driver.find_element(By.XPATH, "//a[contains(text(), 'Get started')]")
    get_started_btn.click()
    
    # Should navigate to /login
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    WebDriverWait(driver, 10).until(EC.url_contains("/login"))
    assert "/login" in driver.current_url, f"Expected to navigate to /login, but URL is {driver.current_url}"
