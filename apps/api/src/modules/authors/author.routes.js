import { crudRouter } from "../../core/crud-routes.js";
import { CrudController } from "../../core/crud-controller.js";
import { PERMISSIONS } from "../roles/permissions.js";
import { AuthorDtos } from "./author.service.js";
import { PublisherDtos } from "../publishers/publisher.service.js";

// Author and publisher lists are public (catalogue filters); changes need books:manage.
const passThrough = (req, res, next) => next();

export const createAuthorRouter = ({ authorService, authGuard }) =>
  crudRouter({
    controller: new CrudController(authorService),
    dtos: AuthorDtos,
    write: authGuard.requirePermission(PERMISSIONS.BooksManage),
    read: passThrough,
  });

export const createPublisherRouter = ({ publisherService, authGuard }) =>
  crudRouter({
    controller: new CrudController(publisherService),
    dtos: PublisherDtos,
    write: authGuard.requirePermission(PERMISSIONS.BooksManage),
    read: passThrough,
  });
