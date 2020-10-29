
module.exports = {
  siteMetadata: {
    title: "Faizaan Sakib",
    author: "Faizaan Sakib",
    email: "fznsakib@gmail.com",
    siteUrl: "https://faizaan.tech",
  },
  plugins: [
    {
      resolve: `gatsby-plugin-google-analytics`,
      options: {
        trackingId: process.env.GOOGLE_ANALYTICS_TRACKING_ID,
        head: true
      }
    },
    "gatsby-plugin-react-helmet",
    {
      resolve: "gatsby-source-contentful",
      options: {
        spaceId: process.env.CONTENTFUL_SPACE_ID,
        accessToken: process.env.CONTENTFUL_ACCESS_TOKEN,
      },
    },
    "gatsby-plugin-sass",
    {
      resolve: "gatsby-source-filesystem",
      options: {
        name: "src",
        path: `${__dirname}/src`,
      },
    },
    "gatsby-plugin-sharp",
    {
      resolve: "gatsby-transformer-remark",
      options: {
        plugins: [
          "gatsby-remark-relative-images",
          {
            resolve: "gatsby-remark-images",
            options: {
              maxWidth: 750,
              linkImagesToOriginal: false,
            },
          },
        ],
        icon: "static/favicon.png"
      },
    },
    "gatsby-transformer-sharp",
    {
      resolve: `gatsby-plugin-scroll-reveal`,
      options: {
          threshold: 0.2, // Percentage of an element's area that needs to be visible to launch animation
          once: true, // Defines if animation needs to be launched once
      }
    },
    `gatsby-plugin-sitemap`
  ],
};
