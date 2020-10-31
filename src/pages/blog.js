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
        <div className={blogStyles.section}>
          <div data-sal="slide-down" data-sal-duration="1000" data-sal-easing="ease">
            <h1 className={blogStyles.title}>blog</h1>
            <div className={blogStyles.underline}></div>
          </div>
        

        <ol className={blogStyles.posts}>
          {data.allContentfulBlogPost.edges.map((edge, i) => {
            return (
              <div key={i} data-sal="zoom-out" data-sal-duration="1000" data-sal-easing="ease">
                <li className={blogStyles.post}>
                  <Link to={`/blog/${edge.node.slug}`}>
                    <h2>{edge.node.title}</h2>
                    <p>{edge.node.publishedDate}</p>
                  </Link>
                </li>
              </div>
            );
          })}
        </ol>

        </div>
      </ScrollableLayout>
    </div>
  );
}
