import re

with open('frontend/app/admin/page.tsx', 'r') as f:
    content = f.read()

patterns_to_remove = [
    r'  const \[appToApprove, setAppToApprove\].*?\n',
    r'  const \[appToReject, setAppToReject\].*?\n',
    r'  const \[appRejectReason, setAppRejectReason\].*?\n',
    r'  const \[selectedApplication, setSelectedApplication\].*?\n',
    r'  const \[isAppApproveModalOpen, setIsAppApproveModalOpen\].*?\n',
    r'  const \[isAppRejectModalOpen, setIsAppRejectModalOpen\].*?\n',
    r'  const \[isAppViewDrawerOpen, setIsAppViewDrawerOpen\].*?\n',
]

for pat in patterns_to_remove:
    content = re.sub(pat, '', content)

handle_approve_pattern = re.compile(r'\s*const handleApproveApplication = async \(\) => \{.*?\n\s*\};', re.DOTALL)
content = re.sub(handle_approve_pattern, '', content)

handle_reject_pattern = re.compile(r'\s*const handleRejectApplication = async \(\) => \{.*?\n\s*\};', re.DOTALL)
content = re.sub(handle_reject_pattern, '', content)

# Remove the Modals for Approve, Reject, and View Drawer
approve_modal = re.compile(r'\s*\{isAppApproveModalOpen && appToApprove && \(\s*<div className="fixed.*?Confirm Approval.*?</button>\s*</div>\s*</div>\s*</div>\s*\)\}', re.DOTALL)
content = re.sub(approve_modal, '', content)

reject_modal = re.compile(r'\s*\{isAppRejectModalOpen && appToReject && \(\s*<div className="fixed.*?Confirm Rejection.*?</button>\s*</div>\s*</div>\s*</div>\s*\)\}', re.DOTALL)
content = re.sub(reject_modal, '', content)

view_drawer = re.compile(r'\s*<div className={`fixed.*?Application Details.*?</button>\s*</div>\s*</div>\s*</div>\s*</div>', re.DOTALL)
content = re.sub(view_drawer, '', content)

with open('frontend/app/admin/page.tsx', 'w') as f:
    f.write(content)
print("done")
