export interface PhilippineLocation {
  province: string;
  cities: {
    name: string;
    barangays: string[];
    postalCode: string;
  }[];
}

export const PHILIPPINE_ADDRESS_DATA: PhilippineLocation[] = [
  {
    province: 'Metro Manila (NCR)',
    cities: [
      {
        name: 'Makati City',
        postalCode: '1200',
        barangays: [
          'Bel-Air',
          'Poblacion',
          'San Lorenzo',
          'Urdaneta',
          'Forbes Park',
          'Dasmariñas',
          'San Antonio',
          'Palanan',
          'Guadalupe Nuevo',
          'Guadalupe Viejo',
        ],
      },
      {
        name: 'Taguig City (BGC)',
        postalCode: '1630',
        barangays: [
          'Fort Bonifacio',
          'Pinagsama',
          'Ususan',
          'Tanyag',
          'Western Bicutan',
          'Upper Bicutan',
          'Central Signal Village',
          'Bagumbayan',
        ],
      },
      {
        name: 'Quezon City',
        postalCode: '1100',
        barangays: [
          'Diliman',
          'Loyola Heights',
          'South Triangle',
          'New Manila',
          'Batasan Hills',
          'Commonwealth',
          'Cubao (Socorro)',
          'Tandang Sora',
        ],
      },
      {
        name: 'Pasig City',
        postalCode: '1600',
        barangays: [
          'San Antonio (Ortigas Center)',
          'Kapitolyo',
          'Ugong',
          'Bagong Ilog',
          'Maybunga',
          'Rosario',
          'Santolan',
        ],
      },
      {
        name: 'City of Manila',
        postalCode: '1000',
        barangays: [
          'Malate (Barangay 701)',
          'Ermita (Barangay 667)',
          'Intramuros (Barangay 654)',
          'Binondo (Barangay 289)',
          'Santa Cruz (Barangay 310)',
          'Sampaloc (Barangay 400)',
        ],
      },
    ],
  },
  {
    province: 'Cebu',
    cities: [
      {
        name: 'Cebu City',
        postalCode: '6000',
        barangays: [
          'Lahug (IT Park)',
          'Mabolo',
          'Banilad',
          'Guadalupe',
          'Kasambagan',
          'Apas',
          'Luz',
          'Punta Princesa',
        ],
      },
      {
        name: 'Mandaue City',
        postalCode: '6014',
        barangays: ['Tipolo', 'Subangdaku', 'Banilad', 'Bakilid', 'Alang-alang', 'Centro'],
      },
      {
        name: 'Lapu-Lapu City',
        postalCode: '6015',
        barangays: ['Mactan', 'Maribago', 'Punta Engaño', 'Basak', 'Poblacion', 'Agus'],
      },
    ],
  },
  {
    province: 'Davao del Sur',
    cities: [
      {
        name: 'Davao City',
        postalCode: '8000',
        barangays: [
          'Poblacion District',
          'Buhangin',
          'Talomo',
          'Agdao',
          'Matina Crossing',
          'Toril',
          'Bago Gallera',
        ],
      },
    ],
  },
  {
    province: 'Cavite',
    cities: [
      {
        name: 'Tagaytay City',
        postalCode: '4120',
        barangays: ['Kaybagal South', 'Mendez Crossing East', 'Maharlika East', 'Iruhin Central', 'Tolentino East'],
      },
      {
        name: 'Bacoor City',
        postalCode: '4102',
        barangays: ['Molino III', 'Molino IV', 'Habay I', 'Panapaan IV', 'Zapote I'],
      },
      {
        name: 'Imus City',
        postalCode: '4103',
        barangays: ['Bucandala I', 'Tanzang Luma I', 'Malagasang I-A', 'Anabu II-D'],
      },
    ],
  },
  {
    province: 'Benguet',
    cities: [
      {
        name: 'Baguio City',
        postalCode: '2600',
        barangays: ['Session Road Area', 'Camp 7', 'Loakan Proper', 'Mines View Park', 'Pacdal', 'Bakakeng Central'],
      },
    ],
  },
  {
    province: 'Laguna',
    cities: [
      {
        name: 'Santa Rosa City',
        postalCode: '4026',
        barangays: ['Don Jose', 'Balibago', 'Tagapo', 'Dila', 'Macabling'],
      },
      {
        name: 'Calamba City',
        postalCode: '4027',
        barangays: ['Canlubang', 'Pansol', 'Real', 'Bucal', 'Parian'],
      },
    ],
  },
];
