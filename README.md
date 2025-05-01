# DataForge: Collaborative Dataset Creation & Curation Platform

DataForge is a web-based platform that enables researchers, data scientists, and organizations to collaboratively build, refine, and curate datasets for machine learning through direct contribution and feedback.

## Project Vision

DataForge addresses a critical gap in the machine learning ecosystem: the lack of platforms for ethical, transparent, and collaborative dataset creation. While many AI platforms focus on model training or hosting pre-existing datasets, few emphasize the crucial process of dataset creation itself.

Current dataset creation methods often rely on web scraping, which raises ethical concerns regarding consent, copyright, and bias. DataForge provides a platform where users can actively opt-in to contributing data, collaboratively curate and validate datasets, and ensure proper attribution throughout the process.

## Key Features

- **User Contribution System**: Intuitive interfaces for uploading and annotating different data types
- **Validation Workflows**: Multi-user verification processes to ensure data quality
- **Dataset Versioning**: Tracking changes and maintaining different versions of datasets
- **Quality Metrics**: Automated assessment of dataset quality and completeness
- **Bias Detection**: Tools to identify and address potential biases in datasets
- **Export Functionality**: Options to download datasets in formats compatible with popular ML frameworks
- **Attribution Management**: Systems to track and credit contributions appropriately

## Technologies

### Frontend
- Angular 19
- Angular Material
- NgRx for state management
- RxJS for reactive programming
- TypeScript

### Backend
- Node.js with Express
- PostgreSQL database
- Sequelize ORM
- JWT authentication
- RESTful API design

## Project Status

This project is currently in the initial development phase as part of a senior project course. As such some of the following instructions and details are redundant and unfunctional at the moment.

## Getting Started

### Prerequisites
- Node.js (v16+)
- npm or yarn
- PostgreSQL

### Installation

1. Clone the repository
```bash
git clone https://github.com/Kiktamo/data-forge.git
cd data-forge
```

2. Install frontend dependencies
```bash
npm install
```

3. Install backend dependencies
```bash
cd server
npm install
```

4. Configure environment variables
```bash
# Create .env file in the server directory
cp server/.env.example server/.env
# Edit the .env file with your database credentials and other settings
```

5. Start the development server
```bash
# Start the backend server
cd server
npm run dev

# In a separate terminal, start the frontend
cd ..
npm start
```

6. Open your browser and navigate to `http://localhost:4200`

## Development Roadmap

- Week 1-2: Project Setup and Planning
- Week 3-4: Core Authentication and User System
- Week 5-6: Basic Dataset Management
- Week 7: Technology Prototype
- Week 8-9: Data Contribution Interfaces
- Week 10-11: Data Processing and Export
- Week 12: Testing and Finalization

## Contributing

This project is currently being developed as part of an academic course. Contributions will be welcome after the initial version is completed.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [BYU-Idaho CSE Department](https://www.byui.edu/computer-science-engineering/) for providing the opportunity to work on this senior project
- All the open-source libraries and frameworks that make this project possible