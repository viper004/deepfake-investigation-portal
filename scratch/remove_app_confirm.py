import re

with open('frontend/app/admin/page.tsx', 'r') as f:
    content = f.read()

app_approve = re.compile(r'\s*// Action - Approve Investigator Application\s*const handleAppApproveConfirm = async \(\) => \{.*?\n\s*\};', re.DOTALL)
content = re.sub(app_approve, '', content)

app_reject = re.compile(r'\s*// Action - Reject Investigator Application\s*const handleAppRejectConfirm = async \(\) => \{.*?\n\s*\};', re.DOTALL)
content = re.sub(app_reject, '', content)

with open('frontend/app/admin/page.tsx', 'w') as f:
    f.write(content)
print("done")
