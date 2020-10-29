import { useStaticQuery, graphql } from "gatsby";

export default function TechnologyIcons() {
  const icons = useStaticQuery(graphql`
    query {
        allFile(filter: { relativeDirectory: { eq: "images/technologies" }} sort: {fields: name, order: ASC}) {
            edges {
                node {
                    name
                    publicURL
                }
            }
        }
    }

  `);

  return icons.allFile.edges;
};
