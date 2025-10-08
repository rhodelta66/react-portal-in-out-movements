import React, { useContext, useEffect, useState, useCallback } from 'react';
import { UserContext } from './services/UserContext';
import { Redirect } from 'react-router-dom';

export default function Dashboard() {
	const user = useContext(UserContext);
	const [currentPage, setCurrentPage] = useState(1);
	const [recordsPerPage, setRecordsPerPage] = useState(25);
	const [allData, setAllData] = useState([]);
	const [filteredData, setFilteredData] = useState([]);
	const [clientFilter, setClientFilter] = useState('');
	const [itemFilter, setItemFilter] = useState('');
	const [statusFilter, setStatusFilter] = useState('');
	const [startDate, setStartDate] = useState(getDefaultStartDate());
	const [endDate, setEndDate] = useState(getTodayString());
	const [loading, setLoading] = useState(false);
	const [stats, setStats] = useState({
		totalPallets: 0,
		palletsIn: 0,
		palletsOut: 0,
		containers: 0
	});
	const [selectedContainer, setSelectedContainer] = useState(null);
	const [showModal, setShowModal] = useState(false);

	// Helper functions
	function getTodayString() {
		return new Date().toISOString().split('T')[0];
	}

	function getDefaultStartDate() {
		const today = new Date();
		const thirtyDaysAgo = new Date(today);
		thirtyDaysAgo.setDate(today.getDate() - 30);
		return thirtyDaysAgo.toISOString().split('T')[0];
	}

	function calculateDayCount() {
		const start = new Date(startDate);
		const end = new Date(endDate);
		const diffTime = Math.abs(end - start);
		return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
	}

	// Load data
	const loadData = useCallback(async () => {
		setLoading(true);
		try {
			// Get tenant from JWT claims, fallback to 'MACANT' if not present
			const tenant = (user.claims && user.claims.tenant) || 'MACANT';

			let allRecords = [];
			let offset = 0;
			let hasMore = true;

			while (hasMore) {
				const url = `https://apide2.tsql.app/rws/v1/daily_pallet_movements_compressed_period?ffa_code=${tenant}&date=${startDate}&end_date=${endDate}&offset=${offset}&max=100`;
				const response = await fetch(url);
				const data = await response.json();

				allRecords = allRecords.concat(data.data);

				if (data.next && allRecords.length < data.total) {
					offset += 100;
				} else {
					hasMore = false;
				}
			}

			setAllData(allRecords);
			setFilteredData(allRecords);
			updateStats(allRecords);
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			setLoading(false);
		}
	}, [startDate, endDate, user.claims]);

	useEffect(() => {
		if (user.authenticated) {
			loadData();
		}
	}, [user.authenticated, loadData]);

	// Update statistics
	function updateStats(data) {
		const uniqueContainers = [...new Set(data.map(item => item.container_number))].length;
		const totalPallets = data.reduce((sum, item) => sum + (item.pallets || 0), 0);
		const palletsIn = data.filter(item => !item.out_date || (item.out_date && item.in_date && item.out_date === item.in_date))
			.reduce((sum, item) => sum + (item.pallets || 0), 0);
		const palletsOut = data.filter(item => item.out_date && (!item.in_date || item.out_date !== item.in_date))
			.reduce((sum, item) => sum + (item.pallets || 0), 0);

		setStats({
			totalPallets,
			palletsIn,
			palletsOut,
			containers: uniqueContainers
		});
	}

	// Apply filters
	useEffect(() => {
		const filtered = allData.filter(item => {
			// Skip undefined or null items
			if (!item || !item.client_code) return false;

			const clientMatch = !clientFilter || item.client_code === clientFilter;
			const containerMatch = !itemFilter || item.container_number === itemFilter;
			const statusMatch = !statusFilter ||
				(statusFilter === 'available' && !item.out_date) ||
				(statusFilter === 'shipped' && item.out_date);
			return clientMatch && containerMatch && statusMatch;
		});
		setFilteredData(filtered);
		setCurrentPage(1);
	}, [clientFilter, itemFilter, statusFilter, allData]);

	// Get unique values for filters
	const uniqueClients = [...new Set(allData.filter(item => item && item.client_code).map(item => item.client_code))];
	const uniqueContainers = [...new Set(allData.filter(item => item && item.container_number).map(item => item.container_number))];

	// Pagination
	const totalPages = Math.ceil(filteredData.length / recordsPerPage);
	const startIndex = (currentPage - 1) * recordsPerPage;
	const endIndex = startIndex + recordsPerPage;
	const pageData = filteredData.slice(startIndex, endIndex).filter(item => item && item.client_code);

	// Show container details
	function showContainerDetails(container) {
		setSelectedContainer(container);
		setShowModal(true);
	}

	// If not authenticated, redirect to login
	if (!user.authenticated) {
		return <Redirect to="/account/login" />;
	}

	return (
		<div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
			<style>{`
				:root {
					--primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
					--secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
					--success-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
					--warning-gradient: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
				}

				.dashboard-header {
					background: var(--primary-gradient);
					color: white;
					padding: 2rem 0;
					margin-bottom: 2rem;
					box-shadow: 0 4px 20px rgba(0,0,0,0.1);
					width: 100%;
				}

				.stats-card {
					background: white;
					border-radius: 15px;
					padding: 1.5rem;
					margin-bottom: 1.5rem;
					box-shadow: 0 8px 25px rgba(0,0,0,0.1);
					transition: transform 0.3s ease;
				}

				.stats-card:hover {
					transform: translateY(-5px);
				}

				.stats-icon {
					width: 60px;
					height: 60px;
					border-radius: 50%;
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 1.5rem;
					color: white;
					margin-bottom: 1rem;
				}

				.stats-value {
					font-size: 2rem;
					font-weight: 700;
					color: #2c3e50;
				}

				.stats-label {
					color: #7f8c8d;
					font-size: 0.9rem;
					text-transform: uppercase;
					letter-spacing: 1px;
				}

				.filters-card {
					background: white;
					border-radius: 15px;
					padding: 1.5rem;
					margin-bottom: 1.5rem;
					box-shadow: 0 8px 25px rgba(0,0,0,0.1);
				}

				.table-container {
					background: white;
					border-radius: 15px;
					overflow: hidden;
					box-shadow: 0 8px 25px rgba(0,0,0,0.1);
				}

				.table-header {
					background: var(--primary-gradient);
					color: white;
					padding: 1.5rem;
				}

				.custom-table thead th {
					background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
					font-weight: 600;
					text-transform: uppercase;
					letter-spacing: 1px;
					font-size: 0.8rem;
				}

				.custom-table tbody tr:hover {
					background-color: rgba(102, 126, 234, 0.1);
				}

				.status-badge {
					padding: 0.5rem 1rem;
					border-radius: 20px;
					font-weight: 600;
					font-size: 0.8rem;
					text-transform: uppercase;
					color: white;
				}

				.status-available {
					background: var(--success-gradient);
				}

				.status-shipped {
					background: linear-gradient(135deg, #fd79a8 0%, #e84393 100%);
				}

				.btn-detail {
					background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
					border: none;
					color: white;
					padding: 8px 16px;
					border-radius: 8px;
					font-size: 0.85rem;
				}

				.date-range-badge {
					background: linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%);
					color: white;
					padding: 12px 20px;
					border-radius: 25px;
					font-weight: 600;
					display: inline-block;
				}

				.modal-backdrop-custom {
					position: fixed;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background: rgba(0,0,0,0.5);
					z-index: 1040;
				}

				.modal-custom {
					position: fixed;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					z-index: 1050;
					background: white;
					border-radius: 15px;
					max-width: 800px;
					width: 90%;
					max-height: 90vh;
					overflow-y: auto;
				}

				.modal-header-custom {
					background: var(--primary-gradient);
					color: white;
					padding: 1.5rem;
					border-radius: 15px 15px 0 0;
				}

				.modal-body-custom {
					padding: 2rem;
				}

				.detail-row {
					padding: 12px 0;
					border-bottom: 1px solid #e9ecef;
				}

				.detail-label {
					font-weight: 600;
					color: #495057;
					font-size: 0.9rem;
					text-transform: uppercase;
				}

				.detail-value {
					font-size: 1.1rem;
					color: #2c3e50;
					font-weight: 500;
				}
			`}</style>

			<div className="dashboard-header">
				<div className="container">
					<div className="row align-items-center">
						<div className="col-md-6">
							<h1 className="mb-2">
								<i className="fa fa-warehouse me-3"></i>
								Pallet Movements - Period Analysis
							</h1>
							<p className="mb-0 fs-5" style={{ textTransform: 'capitalize' }}>{((user.claims && user.claims.tenant) || 'MACANT').toLowerCase()} Facility Dashboard</p>
						</div>
						<div className="col-md-3 text-center">
							<small>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</small>
						</div>
						<div className="col-md-3 text-end">
							<div className="d-flex align-items-center justify-content-end">
								<span className="me-3 text-white-50">
									<i className="fa fa-user me-2"></i>
									{user.claims.sub}
								</span>
								<button className="btn btn-light" onClick={user.logOut}>
									<i className="fa fa-sign-out-alt me-2"></i>
									Log uit
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="container">
				{/* Statistics Cards */}
				<div className="row">
					<div className="col-md-3">
						<div className="stats-card">
							<div className="stats-icon" style={{ background: 'var(--primary-gradient)' }}>
								<i className="fa fa-pallet"></i>
							</div>
							<div className="stats-value">{stats.totalPallets.toLocaleString()}</div>
							<div className="stats-label">Total Pallets</div>
						</div>
					</div>
					<div className="col-md-3">
						<div className="stats-card">
							<div className="stats-icon" style={{ background: 'var(--success-gradient)' }}>
								<i className="fa fa-boxes"></i>
							</div>
							<div className="stats-value">{stats.palletsIn.toLocaleString()}</div>
							<div className="stats-label">Pallets In Movement</div>
						</div>
					</div>
					<div className="col-md-3">
						<div className="stats-card">
							<div className="stats-icon" style={{ background: 'var(--warning-gradient)' }}>
								<i className="fa fa-shipping-fast"></i>
							</div>
							<div className="stats-value">{stats.palletsOut.toLocaleString()}</div>
							<div className="stats-label">Pallets Out Movement</div>
						</div>
					</div>
					<div className="col-md-3">
						<div className="stats-card">
							<div className="stats-icon" style={{ background: 'var(--secondary-gradient)' }}>
								<i className="fa fa-building"></i>
							</div>
							<div className="stats-value">{stats.containers}</div>
							<div className="stats-label">Containers</div>
						</div>
					</div>
				</div>

				{/* Filters */}
				<div className="filters-card">
					<div className="row mb-3">
						<div className="col-md-4">
							<label className="form-label">
								<i className="fa fa-calendar-alt me-2"></i>
								Start Date
							</label>
							<input
								type="date"
								className="form-control"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
							/>
						</div>
						<div className="col-md-4">
							<label className="form-label">
								<i className="fa fa-calendar-check me-2"></i>
								End Date
							</label>
							<input
								type="date"
								className="form-control"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
							/>
						</div>
						<div className="col-md-4">
							<label className="form-label">Records per page</label>
							<select className="form-control" value={recordsPerPage} onChange={(e) => { setRecordsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}>
								<option value="10">10 records</option>
								<option value="25">25 records</option>
								<option value="50">50 records</option>
								<option value="100">100 records</option>
							</select>
						</div>
					</div>
					<div className="row mb-3">
						<div className="col-md-12 text-center">
							<div className="date-range-badge">
								<i className="fa fa-calendar-week me-2"></i>
								Period: {new Date(startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} → {new Date(endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
								<span className="ms-3"><i className="fa fa-calendar-day me-1"></i>{calculateDayCount()} days</span>
							</div>
						</div>
					</div>
					<div className="row">
						<div className="col-md-3">
							<label className="form-label">Filter by Client</label>
							<select className="form-control" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
								<option value="">All Clients</option>
								{uniqueClients.map(client => (
									<option key={client} value={client}>{client}</option>
								))}
							</select>
						</div>
						<div className="col-md-3">
							<label className="form-label">Filter by Container</label>
							<select className="form-control" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
								<option value="">All Containers</option>
								{uniqueContainers.map(container => (
									<option key={container} value={container}>{container}</option>
								))}
							</select>
						</div>
						<div className="col-md-3">
							<label className="form-label">Filter by Status</label>
							<select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
								<option value="">All Status</option>
								<option value="available">Pallets In Movement</option>
								<option value="shipped">Pallets Out Movement</option>
							</select>
						</div>
						<div className="col-md-3">
							<label className="form-label">&nbsp;</label>
							<button className="btn btn-outline-secondary d-block w-100" onClick={() => {
								setClientFilter('');
								setItemFilter('');
								setStatusFilter('');
							}}>
								<i className="fa fa-eraser me-2"></i>
								Clear Filters
							</button>
						</div>
					</div>
				</div>

				{/* Loading Spinner */}
				{loading && (
					<div className="text-center p-5">
						<div className="spinner-border text-primary" role="status">
							<span className="visually-hidden">Loading...</span>
						</div>
						<div className="mt-3">Loading pallet data...</div>
					</div>
				)}

				{/* Data Table */}
				{!loading && (
					<div className="table-container">
						<div className="table-header">
							<h4 className="mb-0">
								<i className="fa fa-table me-2"></i>
								Container Summary Detail - Period View
							</h4>
						</div>
						<div className="table-responsive">
							<table className="table custom-table mb-0">
								<thead>
									<tr>
										<th><i className="fa fa-user me-2"></i>Client</th>
										<th><i className="fa fa-ship me-2"></i>Container</th>
										<th><i className="fa fa-file-alt me-2"></i>BL Number</th>
										<th><i className="fa fa-pallet me-2"></i>Pallets</th>
										<th><i className="fa fa-calendar me-2"></i>In Date</th>
										<th><i className="fa fa-calendar-times me-2"></i>Out Date</th>
										<th><i className="fa fa-info-circle me-2"></i>Status</th>
										<th><i className="fa fa-eye me-2"></i>Actions</th>
									</tr>
								</thead>
								<tbody>
									{pageData.length === 0 ? (
										<tr>
											<td colSpan="8" className="text-center p-4">
												No data available for the selected period and filters.
											</td>
										</tr>
									) : (
										pageData.map((item, index) => {
											const isOut = item.out_date;
											return (
												<tr key={index}>
													<td><strong>{item.client_code}</strong></td>
													<td><span className="text-muted">{item.container_number}</span></td>
													<td><span className="text-muted">{item.bl_number}</span></td>
													<td><span className="badge bg-primary">{item.pallets} pallets</span></td>
													<td>{item.in_date ? new Date(item.in_date).toLocaleDateString() : <span className="text-muted">N/A</span>}</td>
													<td>{item.out_date ? new Date(item.out_date).toLocaleDateString() : <span className="text-muted">-</span>}</td>
													<td>
														<span className={`status-badge ${isOut ? 'status-shipped' : 'status-available'}`}>
															<i className={`fa ${isOut ? 'fa-truck' : 'fa-check-circle'} me-1`}></i>
															{isOut ? 'Pallets Out' : 'Pallets In'}
														</span>
													</td>
													<td>
														<button className="btn btn-detail" onClick={() => showContainerDetails(item)}>
															<i className="fa fa-eye me-1"></i>
															Details
														</button>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</div>
				)}

				{/* Pagination */}
				{!loading && filteredData.length > 0 && (
					<div className="filters-card mt-3">
						<div className="row align-items-center">
							<div className="col-md-6">
								<div className="text-muted">
									Showing {startIndex + 1}-{Math.min(endIndex, filteredData.length)} of {filteredData.length} records
								</div>
							</div>
							<div className="col-md-6">
								<nav>
									<ul className="pagination justify-content-end mb-0">
										<li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
											<button className="page-link" onClick={() => setCurrentPage(currentPage - 1)}>
												<i className="fa fa-chevron-left"></i>
											</button>
										</li>
										{Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
											<li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
												<button className="page-link" onClick={() => setCurrentPage(page)}>
													{page}
												</button>
											</li>
										))}
										<li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
											<button className="page-link" onClick={() => setCurrentPage(currentPage + 1)}>
												<i className="fa fa-chevron-right"></i>
											</button>
										</li>
									</ul>
								</nav>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Modal */}
			{showModal && selectedContainer && (
				<>
					<div className="modal-backdrop-custom" onClick={() => setShowModal(false)}></div>
					<div className="modal-custom">
						<div className="modal-header-custom">
							<h5>
								<i className="fa fa-ship me-2"></i>
								Container {selectedContainer.container_number} - {selectedContainer.client_code}
							</h5>
						</div>
						<div className="modal-body-custom">
							<div className="row">
								<div className="col-md-6">
									<div className="detail-row">
										<div className="detail-label">Container Number</div>
										<div className="detail-value">{selectedContainer.container_number}</div>
									</div>
									<div className="detail-row">
										<div className="detail-label">Client Code</div>
										<div className="detail-value">{selectedContainer.client_code}</div>
									</div>
									<div className="detail-row">
										<div className="detail-label">Bill of Lading</div>
										<div className="detail-value">{selectedContainer.bl_number}</div>
									</div>
									<div className="detail-row">
										<div className="detail-label">Total Pallets</div>
										<div className="detail-value">
											<span className="badge bg-primary">{selectedContainer.pallets} pallets</span>
										</div>
									</div>
								</div>
								<div className="col-md-6">
									<div className="detail-row">
										<div className="detail-label">Status</div>
										<div className="detail-value">
											<span className={`status-badge ${selectedContainer.out_date ? 'status-shipped' : 'status-available'}`}>
												{selectedContainer.out_date ? 'Pallets Out' : 'Pallets In'}
											</span>
										</div>
									</div>
									<div className="detail-row">
										<div className="detail-label">In Date</div>
										<div className="detail-value">
											{selectedContainer.in_date ? new Date(selectedContainer.in_date).toLocaleString() : 'N/A'}
										</div>
									</div>
									<div className="detail-row">
										<div className="detail-label">Out Date</div>
										<div className="detail-value">
											{selectedContainer.out_date ? new Date(selectedContainer.out_date).toLocaleString() : 'Still in warehouse'}
										</div>
									</div>
								</div>
							</div>
							<div className="mt-3 text-end">
								<button className="btn btn-secondary" onClick={() => setShowModal(false)}>
									<i className="fa fa-times me-2"></i>
									Close
								</button>
							</div>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
