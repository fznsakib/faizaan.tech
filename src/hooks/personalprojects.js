import { useStaticQuery, graphql } from "gatsby";

export default function PersonalProjects() {
  const info = useStaticQuery(graphql`
    query {
      allContentfulPersonalProject(sort: { fields: date, order: DESC }) {
        edges {
          node {
            name
            tags
            github
            website
            image {
              file {
                url
              }
            }
          }
        }
      }
    }
  `);

  return info.allContentfulPersonalProject.edges;
}
