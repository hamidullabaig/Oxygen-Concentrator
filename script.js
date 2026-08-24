```javascript
// script.js - Oxygen Concentrator Service Website

// =============================================
// DATA STORAGE & STATE MANAGEMENT
// =============================================

class OxygenService {
    constructor() {
        // Initialize data from localStorage or use defaults
        this.loadData();
        this.currentUser = null;
        this.currentBooking = null;
        this.init();
    }

    loadData() {
        // Pricing structure: { type: 'day' or 'hour', rate: number }
        const defaultPricing = {
            dayRate: 45.00,
            hourRate: 6.50,
            currency: '$',
            lastUpdated: new Date().toISOString()
        };

        const defaultBookings = [];
        const defaultUsers = [
            {
                id: 1,
                username: 'admin',
                password: 'admin123',
                role: 'admin',
                name: 'System Administrator'
            }
        ];

        this.pricing = this.getFromStorage('oxygen_pricing') || defaultPricing;
        this.bookings = this.getFromStorage('oxygen_bookings') || defaultBookings;
        this.users = this.getFromStorage('oxygen_users') || defaultUsers;
        this.bookingIdCounter = this.getFromStorage('oxygen_booking_counter') || 1;
    }

    getFromStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Error saving to localStorage:', e);
            return false;
        }
    }

    saveAll() {
        this.saveToStorage('oxygen_pricing', this.pricing);
        this.saveToStorage('oxygen_bookings', this.bookings);
        this.saveToStorage('oxygen_users', this.users);
        this.saveToStorage('oxygen_booking_counter', this.bookingIdCounter);
    }

    // =============================================
    // AUTHENTICATION
    // =============================================

    login(username, password) {
        const user = this.users.find(u => 
            u.username === username && u.password === password
        );
        if (user) {
            this.currentUser = user;
            return { success: true, user: user };
        }
        return { success: false, message: 'Invalid username or password' };
    }

    logout() {
        this.currentUser = null;
        return { success: true };
    }

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    // =============================================
    // BOOKING MANAGEMENT
    // =============================================

    createBooking(bookingData) {
        // Validate booking data
        const validation = this.validateBooking(bookingData);
        if (!validation.valid) {
            return { success: false, message: validation.message };
        }

        // Calculate total cost
        const cost = this.calculateCost(bookingData);

        const booking = {
            id: this.bookingIdCounter++,
            ...bookingData,
            cost: cost,
            status: 'pending', // pending, confirmed, completed, cancelled
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            bookingReference: this.generateReference()
        };

        this.bookings.push(booking);
        this.saveAll();
        return { success: true, booking: booking };
    }

    validateBooking(data) {
        if (!data.customerName || data.customerName.trim().length < 2) {
            return { valid: false, message: 'Customer name is required (minimum 2 characters)' };
        }
        if (!data.phone || data.phone.trim().length < 10) {
            return { valid: false, message: 'Valid phone number is required' };
        }
        if (!data.email || !this.validateEmail(data.email)) {
            return { valid: false, message: 'Valid email address is required' };
        }
        if (!data.address || data.address.trim().length < 5) {
            return { valid: false, message: 'Address is required (minimum 5 characters)' };
        }
        if (!data.rentalType || !['day', 'hour'].includes(data.rentalType)) {
            return { valid: false, message: 'Invalid rental type. Must be "day" or "hour"' };
        }
        if (!data.duration || data.duration < 1) {
            return { valid: false, message: 'Duration must be at least 1' };
        }
        if (!data.startDate || !this.validateDate(data.startDate)) {
            return { valid: false, message: 'Valid start date is required' };
        }
        return { valid: true };
    }

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    validateDate(dateString) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }

    generateReference() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let ref = 'OXY-';
        for (let i = 0; i < 8; i++) {
            ref += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return ref;
    }

    calculateCost(bookingData) {
        const rate = bookingData.rentalType === 'day' 
            ? this.pricing.dayRate 
            : this.pricing.hourRate;
        return rate * bookingData.duration;
    }

    // =============================================
    // BOOKING QUERIES
    // =============================================

    getBookings(filters = {}) {
        let filtered = [...this.bookings];
        
        if (filters.status) {
            filtered = filtered.filter(b => b.status === filters.status);
        }
        if (filters.customerName) {
            filtered = filtered.filter(b => 
                b.customerName.toLowerCase().includes(filters.customerName.toLowerCase())
            );
        }
        if (filters.dateFrom) {
            filtered = filtered.filter(b => b.startDate >= filters.dateFrom);
        }
        if (filters.dateTo) {
            filtered = filtered.filter(b => b.startDate <= filters.dateTo);
        }

        // Sort by creation date (newest first)
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        return filtered;
    }

    getBooking(id) {
        return this.bookings.find(b => b.id === id);
    }

    getBookingByReference(ref) {
        return this.bookings.find(b => b.bookingReference === ref);
    }

    updateBookingStatus(id, status) {
        const booking = this.getBooking(id);
        if (!booking) {
            return { success: false, message: 'Booking not found' };
        }
        
        if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
            return { success: false, message: 'Invalid status' };
        }

        booking.status = status;
        booking.updatedAt = new Date().toISOString();
        this.saveAll();
        return { success: true, booking: booking };
    }

    cancelBooking(id) {
        return this.updateBookingStatus(id, 'cancelled');
    }

    // =============================================
    // PRICING MANAGEMENT (Admin only)
    // =============================================

    updatePricing(dayRate, hourRate) {
        if (!this.isAdmin()) {
            return { success: false, message: 'Admin access required' };
        }

        if (dayRate < 0 || hourRate < 0) {
            return { success: false, message: 'Rates cannot be negative' };
        }

        this.pricing.dayRate = parseFloat(dayRate.toFixed(2));
        this.pricing.hourRate = parseFloat(hourRate.toFixed(2));
        this.pricing.lastUpdated = new Date().toISOString();
        this.saveAll();
        
        return { 
            success: true, 
            pricing: this.pricing,
            message: 'Pricing updated successfully'
        };
    }

    getCurrentPricing() {
        return { ...this.pricing };
    }

    // =============================================
    // STATISTICS & REPORTS
    // =============================================

    getStats() {
        const totalBookings = this.bookings.length;
        const pendingBookings = this.bookings.filter(b => b.status === 'pending').length;
        const confirmedBookings = this.bookings.filter(b => b.status === 'confirmed').length;
        const completedBookings = this.bookings.filter(b => b.status === 'completed').length;
        const cancelledBookings = this.bookings.filter(b => b.status === 'cancelled').length;
        
        const totalRevenue = this.bookings
            .filter(b => b.status === 'completed' || b.status === 'confirmed')
            .reduce((sum, b) => sum + b.cost, 0);

        return {
            totalBookings,
            pendingBookings,
            confirmedBookings,
            completedBookings,
            cancelledBookings,
            totalRevenue,
            activeBookings: pendingBookings + confirmedBookings
        };
    }

    getRecentBookings(limit = 5) {
        return this.getBookings().slice(0, limit);
    }

    // =============================================
    // INITIALIZATION
    // =============================================

    init() {
        // Check if we need to add demo data
        if (this.bookings.length === 0) {
            this.addDemoData();
        }
        this.saveAll();
    }

    addDemoData() {
        const demoBookings = [
            {
                id: this.bookingIdCounter++,
                customerName: 'John Smith',
                phone: '+1 (555) 123-4567',
                email: 'john.smith@email.com',
                address: '123 Main St, Cityville, ST 12345',
                rentalType: 'day',
                duration: 3,
                startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                notes: 'Delivery required to 3rd floor. Elevator available.',
                status: 'confirmed',
                cost: 135.00,
                bookingReference: this.generateReference(),
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: this.bookingIdCounter++,
                customerName: 'Sarah Johnson',
                phone: '+1 (555) 987-6543',
                email: 'sarah.j@email.com',
                address: '456 Oak Ave, Townsville, ST 67890',
                rentalType: 'hour',
                duration: 12,
                startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                notes: 'Medical emergency. Priority handling required.',
                status: 'pending',
                cost: 78.00,
                bookingReference: this.generateReference(),
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: this.bookingIdCounter++,
                customerName: 'Michael Brown',
                phone: '+1 (555) 456-7890',
                email: 'michael.b@email.com',
                address: '789 Pine Rd, Villagetown, ST 34567',
                rentalType: 'day',
                duration: 7,
                startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                notes: 'Will be used for home care. Need instruction manual.',
                status: 'pending',
                cost: 315.00,
                bookingReference: this.generateReference(),
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: this.bookingIdCounter++,
                customerName: 'Emily Davis',
                phone: '+1 (555) 234-5678',
                email: 'emily.d@email.com',
                address: '321 Elm St, Suburbia, ST 23456',
                rentalType: 'day',
                duration: 1,
                startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                notes: 'Completed rental. Equipment returned in good condition.',
                status: 'completed',
                cost: 45.00,
                bookingReference: this.generateReference(),
                createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        this.bookings = [...this.bookings, ...demoBookings];
        this.saveAll();
    }

    // =============================================
    // UTILITY FUNCTIONS
    // =============================================

    formatCurrency(amount) {
        return `${this.pricing.currency}${amount.toFixed(2)}`;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getStatusBadge(status) {
        const badges = {
            pending: 'badge-warning',
            confirmed: 'badge-info',
            completed: 'badge-success',
            cancelled: 'badge-danger'
        };
        return badges[status] || 'badge-secondary';
    }

    getStatusText(status) {
        const texts = {
            pending: 'Pending',
            confirmed: 'Confirmed',
            completed: 'Completed',
            cancelled: 'Cancelled'
        };
        return texts[status] || status;
    }
}

// =============================================
// UI CONTROLLER
// =============================================

class UIController {
    constructor(service) {
        this.service = service;
        this.currentView = 'dashboard';
        this.initUI();
    }

    initUI() {
        // Initialize event listeners
        this.setupNavigation();
        this.setupForms();
        this.setupPricingManagement();
        this.renderDashboard();
        this.renderBookings();
        this.renderPricing();
        this.checkAuthState();
    }

    setupNavigation() {
        // Navigation links
        document.querySelectorAll('[data-view]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                this.showView(view);
            });
        });

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.service.logout();
                this.checkAuthState();
                this.showView('dashboard');
            });
        }

        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('loginUsername').value;
                const password = document.getElementById('loginPassword').value;
                const result = this.service.login(username, password);
                if (result.success) {
                    this.showToast('Login successful!', 'success');
                    this.checkAuthState();
                    this.renderDashboard();
                    this.renderBookings();
                    this.renderPricing();
                    this.showView('dashboard');
                } else {
                    this.showToast(result.message, 'danger');
                }
            });
        }
    }

    setupForms() {
        // Booking form
        const bookingForm = document.getElementById('bookingForm');
        if (bookingForm) {
            bookingForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleBookingSubmit(e);
            });
        }

        // Rental type toggle
        const rentalTypeSelect = document.getElementById('rentalType');
        if (rentalTypeSelect) {
            rentalTypeSelect.addEventListener('change', () => {
                this.updatePricingDisplay();
            });
        }

        // Duration input
        const durationInput = document.getElementById('duration');
        if (durationInput) {
            durationInput.addEventListener('input', () => {
                this.updatePricingDisplay();
            });
        }
    }

    setupPricingManagement() {
        const pricingForm = document.getElementById('pricingForm');
        if (pricingForm) {
            pricingForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handlePricingUpdate(e);
            });
        }
    }

    // =============================================
    // VIEW MANAGEMENT
    // =============================================

    showView(view) {
        this.currentView = view;
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => {
            el.classList.add('d-none');
        });
        // Show selected view
        const targetView = document.getElementById(`${view}View`);
        if (targetView) {
            targetView.classList.remove('d-none');
        }
        // Update active nav link
        document.querySelectorAll('[data-view]').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.view === view) {
                link.classList.add('active');
            }
        });
        // Refresh view content
        this.refreshView(view);
    }

    refreshView(view) {
        switch(view) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'bookings':
                this.renderBookings();
                break;
            case 'pricing':
                this.renderPricing();
                break;
            case 'profile':
                this.renderProfile();
                break;
        }
    }

    // =============================================
    // DASHBOARD
    // =============================================

    renderDashboard() {
        const stats = this.service.getStats();
        const recentBookings = this.service.getRecentBookings(5);

        // Update stats cards
        const statsData = [
            { id: 'totalBookings', value: stats.totalBookings },
            { id: 'activeBookings', value: stats.activeBookings },
            { id: 'pendingBookings', value: stats.pendingBookings },
            { id: 'totalRevenue', value: this.service.formatCurrency(stats.totalRevenue) }
        ];

        statsData.forEach(stat => {
            const element = document.getElementById(`stat${stat.id.charAt(0).toUpperCase() + stat.id.slice(1)}`);
            if (element) {
                element.textContent = stat.value;
            }
        });

        // Render recent bookings table
        const tableBody = document.getElementById('recentBookingsTable');
        if (tableBody) {
            if (recentBookings.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" c
