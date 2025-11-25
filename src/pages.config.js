import Home from './pages/Home';
import NewExpense from './pages/NewExpense';
import MyExpenses from './pages/MyExpenses';
import EditExpense from './pages/EditExpense';
import MyReports from './pages/MyReports';
import NewReport from './pages/NewReport';
import EditReport from './pages/EditReport';
import Assistant from './pages/Assistant';
import AdminDashboard from './pages/AdminDashboard';
import AdminExpenses from './pages/AdminExpenses';
import AdminReports from './pages/AdminReports';
import AdminUsers from './pages/AdminUsers';
import AdminPolicies from './pages/AdminPolicies';
import AdminProjects from './pages/AdminProjects';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminDataPolicy from './pages/AdminDataPolicy';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "NewExpense": NewExpense,
    "MyExpenses": MyExpenses,
    "EditExpense": EditExpense,
    "MyReports": MyReports,
    "NewReport": NewReport,
    "EditReport": EditReport,
    "Assistant": Assistant,
    "AdminDashboard": AdminDashboard,
    "AdminExpenses": AdminExpenses,
    "AdminReports": AdminReports,
    "AdminUsers": AdminUsers,
    "AdminPolicies": AdminPolicies,
    "AdminProjects": AdminProjects,
    "AdminAuditLogs": AdminAuditLogs,
    "AdminDataPolicy": AdminDataPolicy,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};