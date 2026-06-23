import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NutritionFactsLabel from './NutritionFactsLabel'

describe('NutritionFactsLabel', () => {
  it('renders a full label with every section and % Daily Values', () => {
    render(
      <NutritionFactsLabel
        nutritionFacts={{
          serving_size: '1 cup',
          servings_per_container: 2,
          calories: 150,
          total_fat: 78,
          saturated_fat: 20,
          trans_fat: 0,
          cholesterol: 300,
          sodium: 2.3,
          total_carbohydrate: 275,
          dietary_fiber: 28,
          total_sugars: 10,
          added_sugars: 50,
          protein: 50,
          vitamin_d: 20,
          calcium: 1300,
          iron: 18,
          potassium: 4700,
        }}
      />
    )
    expect(screen.getByText('Nutrition Facts')).toBeInTheDocument()
    expect(screen.getByText('2 servings per container')).toBeInTheDocument()
    expect(screen.getByText('1 cup')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument() // calories rounded to nearest 10
    expect(screen.getByText(/Total Fat/)).toBeInTheDocument()
    expect(screen.getByText(/Cholesterol/)).toBeInTheDocument()
    expect(screen.getByText(/Sodium/)).toBeInTheDocument()
    expect(screen.getByText(/Total Carbohydrate/)).toBeInTheDocument()
    expect(screen.getByText(/Includes/)).toBeInTheDocument() // added sugars
    expect(screen.getByText(/Protein/)).toBeInTheDocument()
    expect(screen.getByText(/Vitamin D/)).toBeInTheDocument()
    // Several nutrients hit their full daily value -> 100%
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0)
  })

  it('renders an empty label with sensible fallbacks', () => {
    render(<NutritionFactsLabel nutritionFacts={{}} />)
    expect(screen.getByText('Nutrition Facts')).toBeInTheDocument()
    expect(screen.getByText('Not specified')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument() // calories fallback
    // No macro sections rendered
    expect(screen.queryByText(/Total Fat/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Protein/)).not.toBeInTheDocument()
  })

  it('renders servings_per_container when given as a string', () => {
    render(<NutritionFactsLabel nutritionFacts={{ servings_per_container: 'about 3' }} />)
    expect(screen.getByText('about 3')).toBeInTheDocument()
  })

  it('rounds calories to the nearest 5 for the 50–100 range', () => {
    render(<NutritionFactsLabel nutritionFacts={{ calories: 73 }} />)
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('rounds calories to a whole number under 50', () => {
    render(<NutritionFactsLabel nutritionFacts={{ calories: 32.6 }} />)
    expect(screen.getByText('33')).toBeInTheDocument()
  })

  it('shows 0% daily value for zero-valued nutrients', () => {
    render(<NutritionFactsLabel nutritionFacts={{ total_fat: 0 }} />)
    expect(screen.getByText(/Total Fat/)).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('renders a present-but-zero sodium value as 0mg', () => {
    render(<NutritionFactsLabel nutritionFacts={{ sodium: 0 }} />)
    expect(screen.getByText(/Sodium/)).toBeInTheDocument()
    expect(screen.getByText('0mg')).toBeInTheDocument()
  })
})
