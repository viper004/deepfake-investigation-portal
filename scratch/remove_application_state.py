import re

with open('frontend/app/admin/page.tsx', 'r') as f:
    content = f.read()

patterns_to_remove = [
    r'  const \[applications, setApplications\] = useState<any\[\]>\(\[\]\);\n',
    r'  const \[applicationsLoading, setApplicationsLoading\] = useState\(false\);\n',
    r'  const \[applicationsLoaded, setApplicationsLoaded\] = useState\(false\);\n',
    r'  const \[isAppApproveModalOpen, setIsAppApproveModalOpen\] = useState\(false\);\n',
    r'  const \[isAppRejectModalOpen, setIsAppRejectModalOpen\] = useState\(false\);\n',
    r'  const \[isAppViewDrawerOpen, setIsAppViewDrawerOpen\] = useState\(false\);\n',
    r'  const \[appToApprove, setAppToApprove\] = useState<any>\(null\);\n',
    r'  const \[appToReject, setAppToReject\] = useState<any>\(null\);\n',
    r'  const \[appRejectReason, setAppRejectReason\] = useState\(""\);\n',
    r'  const \[selectedApplication, setSelectedApplication\] = useState<any>\(null\);\n',
]

for pat in patterns_to_remove:
    content = re.sub(pat, '', content)

# Remove fetchApplications block entirely
fetch_app_pattern = re.compile(r'\s*const fetchApplications = useCallback.*?\} catch \(err\) \{.*?\}.*?\}, \[session\?\.accessToken, showToast\]\);', re.DOTALL)
content = re.sub(fetch_app_pattern, '', content)

# Remove handleApproveApplication and handleRejectApplication blocks
handle_approve_pattern = re.compile(r'\s*const handleApproveApplication = async \(\) => \{.*?\} catch \(err\) \{.*?\}.*?\};', re.DOTALL)
content = re.sub(handle_approve_pattern, '', content)

handle_reject_pattern = re.compile(r'\s*const handleRejectApplication = async \(\) => \{.*?\} catch \(err\) \{.*?\}.*?\};', re.DOTALL)
content = re.sub(handle_reject_pattern, '', content)

# Remove the Modals for Approve, Reject, and View Drawer
approve_modal = re.compile(r'\s*<Modal\s*isOpen=\{isAppApproveModalOpen\}.*?Confirm Approval.*?</Modal>', re.DOTALL)
content = re.sub(approve_modal, '', content)

reject_modal = re.compile(r'\s*<Modal\s*isOpen=\{isAppRejectModalOpen\}.*?Confirm Rejection.*?</Modal>', re.DOTALL)
content = re.sub(reject_modal, '', content)

view_drawer = re.compile(r'\s*<SideDrawer\s*isOpen=\{isAppViewDrawerOpen\}.*?Application Details.*?</SideDrawer>', re.DOTALL)
content = re.sub(view_drawer, '', content)

# Clean up useEffect dependencies and calls
content = re.sub(r'fetchApplications\(true\);\n', '', content)
content = re.sub(r'fetchApplications\(\);\n', '', content)
content = re.sub(r',\s*fetchApplications', '', content)
content = re.sub(r',\s*applicationsLoaded', '', content)

with open('frontend/app/admin/page.tsx', 'w') as f:
    f.write(content)
print("done")
