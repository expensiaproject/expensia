import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminDashboard from './pages/AdminDashboard';
import AdminExpenses from './pages/AdminExpenses';
import AdminReports from './pages/AdminReports';
import AdminUsers from './pages/AdminUsers';
import Assistant from './pages/Assistant';
import CreateTripReport from './pages/CreateTripReport';
import Home from './pages/Home';
import MyExpenses from './pages/MyExpenses';
import MyReports from './pages/MyReports';
import TripReportDetails from './pages/TripReportDetails';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminAuditLogs": AdminAuditLogs,
    "AdminDashboard": AdminDashboard,
    "AdminExpenses": AdminExpenses,
    "AdminReports": AdminReports,
    "AdminUsers": AdminUsers,
    "Assistant": Assistant,
    "CreateTripReport": CreateTripReport,
    "Home": Home,
    "MyExpenses": MyExpenses,
    "MyReports": MyReports,
    "TripReportDetails": TripReportDetails,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};