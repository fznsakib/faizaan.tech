import React from "react";
import { Link, graphql, useStaticQuery } from "gatsby";

import ScrollableLayout from "../components/scrollablelayout";
import Head from "../components/head";

import blogStyles from "./blog.module.scss";

export default function Blog() {
  const data = useStaticQuery(graphql`
    query {
      allContentfulBlogPost(sort: { fields: publishedDate, order: DESC }) {
        edges {
          node {
            title
            slug
            publishedDate(
              formatString: "Do MMMM YYYY"
              # fromNow:true
            )
          }
        }
      }
    }
  `);

  return (
    <div>
      <ScrollableLayout>
        <Head title="Blog" />
        <main className={blogStyles.section}>
          <div>
            <h1 className={blogStyles.title}>blog</h1>
            <div className={blogStyles.underline}></div>
          </div>

          <ol className={blogStyles.posts}>
            {data.allContentfulBlogPost.edges.map((edge, i) => {
              return (
                <div key={i}>
                  <li
                    className={blogStyles.post}
                    style={{ "--fade-delay": `${1 + i * 0.25}s` }}
                  >
                    <Link to={`/blog/${edge.node.slug}`}>
                      <h2 className={blogStyles.postTitle}>
                        {edge.node.title}
                      </h2>
                      <p>{edge.node.publishedDate}</p>
                    </Link>
                  </li>
                </div>
              );
            })}
          </ol>
        </main>
      </ScrollableLayout>
    </div>
  );
}
