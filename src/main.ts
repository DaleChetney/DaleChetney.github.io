import "./styles.css";
import { el, mount, qs } from "@shared/dom";
import { projects } from "./projects";

const card = (slug: string, title: string, description: string): HTMLElement =>
  el("a", { href: `/${slug}/`, className: "card" }, [
    el("h2", {}, [title]),
    el("p", {}, [description]),
  ]);

mount(
  qs("#app"),
  el(
    "div",
    { className: "grid" },
    projects.map((p) => card(p.slug, p.title, p.description)),
  ),
);
