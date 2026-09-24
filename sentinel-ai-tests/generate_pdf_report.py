import base64
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.print_page_options import PrintOptions

def convert_html_to_pdf():
    html_path = os.path.abspath("report.html")
    pdf_path = os.path.abspath("report.pdf")
    
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    driver = webdriver.Chrome(options=options)
    try:
        driver.get(f"file://{html_path}")
        
        # Use Selenium 4 print_page capability
        print_options = PrintOptions()
        print_options.background = True
        
        pdf_base64 = driver.print_page(print_options)
        pdf_bytes = base64.b64decode(pdf_base64)
        
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
            
        print(f"PDF successfully created at {pdf_path}")
    finally:
        driver.quit()

if __name__ == "__main__":
    convert_html_to_pdf()
