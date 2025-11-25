import Home from './pages/Home';
import NewExpense from './pages/NewExpense';
import MyExpenses from './pages/MyExpenses';
import EditExpense from './pages/EditExpense';
import MyReports from './pages/MyReports';
import NewReport from './pages/NewReport';
import EditReport from './pages/EditReport';
import Assistant from './pages/Assistant';
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
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};