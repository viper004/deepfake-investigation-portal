import re

with open('frontend/app/admin/page.tsx', 'r') as f:
    content = f.read()

# 1. Update the Tabs Array
content = content.replace(
    '["Active Investigators", "Pending Invitations", "Pending Verification", "Invitation Logs"]',
    '["Active Investigators", "Pending Invitations", "Invitation Logs"]'
)

# 2. Remove the notification badge on the Pending Verification tab
badge_pattern = re.compile(r'\s*\{tab === "Pending Verification" && applications\.length > 0 && \(\s*<span[^>]+>\{applications\.length\}</span>\s*\)\}', re.DOTALL)
content = re.sub(badge_pattern, "", content)

# 3. Remove the Pending Verification Tab Content entirely
tab_content_pattern = re.compile(r'\s*\{investigatorsTab === "Pending Verification" && \(\s*<div className="bg-white border.*?</div>\s*\)\}', re.DOTALL)
content = re.sub(tab_content_pattern, "", content)

# Write back
with open('frontend/app/admin/page.tsx', 'w') as f:
    f.write(content)
print("done")
