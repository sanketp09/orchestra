// Typed fetch wrappers for every backend route per 04-API-CONTRACTS.md

export async function fetchDashboardDecisions() {
  // GET /dashboard/decisions
}

export async function searchDashboard(q: string) {
  // GET /dashboard/search?q=
}

export async function analyzeXRay(formData: FormData) {
  // POST /xray/analyze
}

export async function fetchReceipt(decisionId: string) {
  // GET /receipt/:decision_id
}

export async function fetchVendorTrust(vendorId: string) {
  // GET /vendor/:id/trust
}

export async function fetchVendorTimeline(vendorId: string) {
  // GET /vendor/:id/timeline
}

export async function postVendorEvidence(vendorId: string, data: any) {
  // POST /vendor/:id/evidence
}

export async function fetchEvidence(search?: string, type?: string) {
  // GET /evidence?search=&type=
}

export async function fetchEvidenceById(id: string) {
  // GET /evidence/:id
}

export async function uploadSupplierDocument(supplierId: string, data: any) {
  // POST /supplier/:id/upload
}

export async function fetchSupplierChecklist(supplierId: string) {
  // GET /supplier/:id/checklist
}

export async function postSearch(query: string) {
  // POST /search
}

export async function fetchProjectTimeline(projectId: string) {
  // GET /project/:id/timeline
}

export async function postSiteVoiceCapture(data: any) {
  // POST /site/voice-capture
}
