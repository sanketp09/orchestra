from orchestra.cases_data import crossrail_case, data_center_case, tsmc_case

CROSSRAIL_CASE = {
    "project": crossrail_case.PROJECT,
    "sources": crossrail_case.SOURCES,
    "vendors": crossrail_case.VENDORS,
    "procurement_items": crossrail_case.PROCUREMENT_ITEMS,
    "purchase_orders": crossrail_case.PURCHASE_ORDERS,
    "engineering_changes": crossrail_case.ENGINEERING_CHANGES,
    "schedule_events": crossrail_case.SCHEDULE_EVENTS,
    "vendor_performances": crossrail_case.VENDOR_PERFORMANCES,
    "claims": crossrail_case.CLAIMS,
    "evidence": crossrail_case.EVIDENCE,
}

DATA_CENTER_CASE = {
    "project": data_center_case.PROJECT,
    "sources": data_center_case.SOURCES,
    "vendors": data_center_case.VENDORS,
    "procurement_items": data_center_case.PROCUREMENT_ITEMS,
    "purchase_orders": data_center_case.PURCHASE_ORDERS,
    "engineering_changes": data_center_case.ENGINEERING_CHANGES,
    "schedule_events": data_center_case.SCHEDULE_EVENTS,
    "vendor_performances": data_center_case.VENDOR_PERFORMANCES,
    "claims": data_center_case.CLAIMS,
    "evidence": data_center_case.EVIDENCE,
}

TSMC_CASE = {
    "project": tsmc_case.PROJECT,
    "sources": tsmc_case.SOURCES,
    "vendors": tsmc_case.VENDORS,
    "procurement_items": tsmc_case.PROCUREMENT_ITEMS,
    "purchase_orders": tsmc_case.PURCHASE_ORDERS,
    "engineering_changes": tsmc_case.ENGINEERING_CHANGES,
    "schedule_events": tsmc_case.SCHEDULE_EVENTS,
    "vendor_performances": tsmc_case.VENDOR_PERFORMANCES,
    "claims": tsmc_case.CLAIMS,
    "evidence": tsmc_case.EVIDENCE,
}

ALL_CASES = {
    crossrail_case.PROJECT_ID: CROSSRAIL_CASE,
    data_center_case.PROJECT_ID: DATA_CENTER_CASE,
    tsmc_case.PROJECT_ID: TSMC_CASE,
}
