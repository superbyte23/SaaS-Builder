import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import organizationsRouter from "./organizations";
import branchesRouter from "./branches";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import inventoryRouter from "./inventory";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import suppliersRouter from "./suppliers";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(organizationsRouter);
router.use(branchesRouter);
router.use(usersRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(inventoryRouter);
router.use(customersRouter);
router.use(ordersRouter);
router.use(suppliersRouter);
router.use(dashboardRouter);
router.use(reportsRouter);

export default router;
