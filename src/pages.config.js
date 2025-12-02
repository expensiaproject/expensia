import Home from './pages/Home';
import MyExpenses from './pages/MyExpenses';
import MyReports from './pages/MyReports';
import Assistant from './pages/Assistant';
import AdminDashboard from './pages/AdminDashboard';
import AdminExpenses from './pages/AdminExpenses';
import AdminReports from './pages/AdminReports';
import AdminUsers from './pages/AdminUsers';
import AdminPolicies from './pages/AdminPolicies';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminDataPolicy from './pages/AdminDataPolicy';
import CreateTripReport from './pages/CreateTripReport';
import TripReportDetails from './pages/TripReportDetails';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "MyExpenses": MyExpenses,
    "MyReports": MyReports,
    "Assistant": Assistant,
    "AdminDashboard": AdminDashboard,
    "AdminExpenses": AdminExpenses,
    "AdminReports": AdminReports,
    "AdminUsers": AdminUsers,
    "AdminPolicies": AdminPolicies,
    "AdminAuditLogs": AdminAuditLogs,
    "AdminDataPolicy": AdminDataPolicy,
    "CreateTripReport": CreateTripReport,
    "TripReportDetails": TripReportDetails,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};