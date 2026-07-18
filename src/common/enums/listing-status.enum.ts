export enum ListingStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  UNDER_OFFER = 'under_offer',
  SOLD = 'sold',
  RENTED = 'rented',
  ARCHIVED = 'archived',
}

export enum PropertyType {
  APARTMENT = 'apartment',
  HOUSE = 'house',
  LAND = 'land',
  COMMERCIAL = 'commercial',
  DUPLEX = 'duplex',
  BUNGALOW = 'bungalow',
}

export enum ListingPurpose {
  SALE = 'sale',
  RENT = 'rent',
}

export enum SpaceKind {
  SINGLE_UNIT = 'single_unit',
  ESTATE = 'estate',
}

export enum PaymentFrequency {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  ONE_TIME = 'one_time',
  WEEKLY = 'weekly',
  DAILY = 'daily',
}

export enum ListingCategory {
  TWO_BEDROOM = '2_bedroom',
  THREE_BEDROOM = '3_bedroom',
  LAND = 'land',
  SELF_CON = 'self_con',
  OTHER = 'other',
}

export enum ListingSortBy {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  RATING = 'rating',
}
