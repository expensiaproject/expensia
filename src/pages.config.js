import Home from './pages/Home';
import NewExpense from './pages/NewExpense';
import MyExpenses from './pages/MyExpenses';
import EditExpense from './pages/EditExpense';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "NewExpense": NewExpense,
    "MyExpenses": MyExpenses,
    "EditExpense": EditExpense,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};